import { Command } from 'commander';
import * as p from '@clack/prompts';
import color from 'picocolors';
import { BrowserPool, PageInteractor } from '@tendo/browser';
import { createProvider } from '../agent/config.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function isBlockedByRobots(robotsTxt: string, targetUrl: string): boolean {
  const urlPath = new URL(targetUrl).pathname;
  let inRelevantBlock = false;
  for (const rawLine of robotsTxt.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('User-agent:')) {
      inRelevantBlock = line.replace('User-agent:', '').trim() === '*';
    } else if (inRelevantBlock && line.startsWith('Disallow:')) {
      const disallowed = line.replace('Disallow:', '').trim();
      if (disallowed === '/' || (disallowed && urlPath.startsWith(disallowed))) {
        return true;
      }
    }
  }
  return false;
}

export const validateCommand = new Command()
  .name('validate')
  .description('Run pre-flight smoke test on a URL')
  .argument('<url>', 'The URL to validate')
  .option('--save-screenshot', 'Save baseline screenshot to ~/.tendo/validate/')
  .action(async (url: string, options) => {
    p.intro(color.bgBlue(color.black(' Tendo Validate ')));

    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;

    let failed = false;

    // 1. Reachability
    const s1 = p.spinner();
    s1.start('Checking URL reachability...');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(targetUrl, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
      clearTimeout(timeout);
      if (res.status < 400) {
        s1.stop(`${color.green('✓')} Reachable — HTTP ${res.status}`);
      } else {
        s1.stop(`${color.yellow('⚠')} HTTP ${res.status} — server returned an error status`);
      }
    } catch (error) {
      s1.stop(`${color.red('✗')} Unreachable — ${(error as Error).message}`);
      p.outro(color.red('Validation failed — URL is not reachable'));
      process.exit(1);
    }

    // 2. robots.txt
    const s2 = p.spinner();
    s2.start('Checking robots.txt...');
    try {
      const origin = new URL(targetUrl).origin;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${origin}/robots.txt`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const text = await res.text();
        if (isBlockedByRobots(text, targetUrl)) {
          s2.stop(`${color.yellow('⚠')} robots.txt disallows crawling this path — proceed with caution`);
        } else {
          s2.stop(`${color.green('✓')} robots.txt permits access`);
        }
      } else {
        s2.stop(`${color.green('✓')} No robots.txt — no restrictions`);
      }
    } catch {
      s2.stop(`${color.dim('–')} Could not fetch robots.txt — skipping`);
    }

    // 3. Baseline screenshot
    const s3 = p.spinner();
    s3.start('Capturing baseline screenshot...');
    const pool = new BrowserPool({ maxBrowsers: 1, maxPagesPerBrowser: 1 });
    try {
      const interactor = await PageInteractor.create(pool, {
        headless: true,
        viewport: { width: 1280, height: 720 },
      });
      await interactor.navigateTo(targetUrl);
      const { title, url: finalUrl } = await interactor.getPageInfo();
      const screenshotBase64 = await interactor.screenshot();
      await interactor.release();

      s3.stop(`${color.green('✓')} Page loaded — "${title}"`);
      if (finalUrl !== targetUrl) {
        p.log.info(color.dim(`  Redirected to: ${finalUrl}`));
      }

      if (options.saveScreenshot) {
        const dir = path.join(os.homedir(), '.tendo', 'validate');
        fs.mkdirSync(dir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const screenshotPath = path.join(dir, `baseline-${timestamp}.png`);
        fs.writeFileSync(screenshotPath, Buffer.from(screenshotBase64, 'base64'));
        p.log.info(color.dim(`  Screenshot: ${screenshotPath}`));
      }
    } catch (error) {
      s3.stop(`${color.red('✗')} Browser error — ${(error as Error).message}`);
      failed = true;
    } finally {
      await pool.dispose();
    }

    // 4. LLM provider
    const s4 = p.spinner();
    s4.start('Checking LLM provider...');
    try {
      const provider = createProvider();
      s4.stop(`${color.green('✓')} Provider ready — ${color.cyan(provider.name)}`);
    } catch (error) {
      s4.stop(`${color.red('✗')} Provider error — ${(error as Error).message}`);
      failed = true;
    }

    p.log.message('');
    if (failed) {
      p.outro(color.red('Validation failed — fix the issues above before running a test'));
      process.exit(1);
    } else {
      p.outro(color.green('All checks passed — ready to test'));
    }
  });
