import { Command } from 'commander';
import * as p from '@clack/prompts';
import color from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import type { TestResult } from '@tendo/core';
import { AgentRunner } from '@tendo/agent';
import { createProvider } from '../agent/config.js';
import { generateReport } from '../ReportGenerator.js';

const WATCH_ROOT = path.join(os.homedir(), '.tendo', 'watch');

function findResultJson(sessionDir: string): string | null {
  if (!fs.existsSync(sessionDir)) return null;
  const timestamps = fs.readdirSync(sessionDir)
    .filter(d => fs.statSync(path.join(sessionDir, d)).isDirectory())
    .sort()
    .reverse();
  for (const ts of timestamps) {
    const candidate = path.join(sessionDir, ts, 'result.json');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveResultPath(id?: string): string {
  if (!id) {
    if (!fs.existsSync(WATCH_ROOT)) throw new Error('No watch sessions found — run tendo watch first');
    const sessions = fs.readdirSync(WATCH_ROOT)
      .filter(d => /^\d+$/.test(d))
      .sort((a, b) => Number(b) - Number(a));
    for (const session of sessions) {
      const found = findResultJson(path.join(WATCH_ROOT, session));
      if (found) return found;
    }
    throw new Error('No result.json found in any watch session');
  }

  if (/^\d+$/.test(id)) {
    const sessionDir = path.join(WATCH_ROOT, id);
    if (!fs.existsSync(sessionDir)) throw new Error(`Watch session ${id} not found at ${sessionDir}`);
    const found = findResultJson(sessionDir);
    if (!found) throw new Error(`No result.json in session ${id} — run tendo watch first or use tendo test -o`);
    return found;
  }

  const resolved = path.resolve(id);
  if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);
  return resolved;
}

function openInBrowser(filePath: string): void {
  const url = `file://${filePath}`;
  const cmd = process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

function reportDir(): string {
  const dir = path.join(os.homedir(), '.tendo', 'report');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function defaultOutputPath(label: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(reportDir(), `${label}-${timestamp}.html`);
}

function resolveOutputPath(file: string): string {
  return path.isAbsolute(file) ? file : path.join(reportDir(), file);
}

export const reportCommand = new Command()
  .name('report')
  .description('Generate an HTML report — from a saved result or by running a test inline')
  .argument('[id]', 'URL (with -p), path to result.json, watch session number, or omit for latest')
  .option('-p, --prompt <prompt>', 'Run a live test against the URL and report immediately')
  .option('--viewport <viewport>', 'Viewport size when running live (default: 1920,1080)', '1920,1080')
  .option('-o, --output <file>', 'Output HTML file path')
  .option('--no-open', 'Do not open the report in a browser')
  .action(async (id: string | undefined, options) => {
    p.intro(color.bgCyan(color.black(' Tendo Report ')));

    let result: TestResult;
    let outputPath: string;

    if (options.prompt) {
      // ── Live run mode ────────────────────────────────────────────────
      if (!id) {
        p.log.error('A URL is required when using -p');
        p.outro(color.red('Report generation failed'));
        process.exit(1);
      }

      let targetUrl = id;
      if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;

      let provider;
      try {
        provider = createProvider();
      } catch (error) {
        p.log.error((error as Error).message);
        p.outro(color.red('Report generation failed'));
        process.exit(1);
      }

      const [w, h] = options.viewport.split(',').map(Number);
      const viewport = { width: w || 1920, height: h || 1080 };

      const runner = new AgentRunner(provider);
      const s = p.spinner();

      runner.on('init', () => {
        p.log.info(`${color.dim('URL:')}    ${color.cyan(targetUrl)}`);
        p.log.info(`${color.dim('Prompt:')} ${color.yellow(options.prompt)}`);
        p.log.message('');
      });

      runner.on('step:start', ({ step }: { step: number }) => {
        s.start(`Step ${step}: Analyzing page...`);
      });

      runner.on('step:decision', ({ step, action }: { step: number; thought: string; action: { type: string } }) => {
        s.stop(`Step ${step}: ${color.bold(action.type.toUpperCase())}`);
      });

      runner.on('error', ({ step, error }: { step: number; error: Error }) => {
        s.stop(`Step ${step} failed`);
        p.log.error(color.red(`  Error: ${error.message}`));
      });

      let finalState;
      try {
        finalState = await runner.run({ url: targetUrl, prompt: options.prompt, headless: true, viewport });
      } catch (error) {
        p.log.error(color.red(`Fatal error: ${(error as Error).message}`));
        p.outro(color.red('Report generation failed'));
        process.exit(1);
      }

      result = {
        success: finalState.success,
        url: targetUrl,
        prompt: options.prompt,
        steps: finalState.step,
        actions: finalState.actions.flatMap((a: string) => {
          try { return [JSON.parse(a)]; } catch { return []; }
        }),
        finalUrl: finalState.currentUrl,
        timestamp: new Date().toISOString(),
        screenshots: finalState.screenshots,
      };

      const label = new URL(targetUrl).hostname.replace(/\./g, '-');
      outputPath = options.output ? resolveOutputPath(options.output) : defaultOutputPath(label);

    } else {
      // ── Load from file/session mode ──────────────────────────────────
      let resultPath: string;
      try {
        resultPath = resolveResultPath(id);
      } catch (error) {
        p.log.error((error as Error).message);
        p.outro(color.red('Report generation failed'));
        process.exit(1);
      }

      p.log.info(`Source: ${color.dim(resultPath)}`);

      try {
        result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
      } catch (error) {
        p.log.error(`Could not read result file: ${(error as Error).message}`);
        p.outro(color.red('Report generation failed'));
        process.exit(1);
      }

      outputPath = options.output
        ? resolveOutputPath(options.output)
        : defaultOutputPath(path.basename(path.dirname(resultPath)));
    }

    // ── Generate & write HTML ────────────────────────────────────────
    const gs = p.spinner();
    gs.start('Generating report...');
    let html: string;
    try {
      html = generateReport(result);
      gs.stop(`${color.green('✓')} Generated — ${result.actions.length} steps, ${result.screenshots?.length ?? 0} screenshots`);
    } catch (error) {
      gs.stop(`${color.red('✗')} Generation failed`);
      p.log.error((error as Error).message);
      p.outro(color.red('Report generation failed'));
      process.exit(1);
    }

    try {
      fs.writeFileSync(outputPath, html, 'utf-8');
      p.log.success(`Saved: ${color.cyan(outputPath)}`);
    } catch (error) {
      p.log.error(`Could not write report: ${(error as Error).message}`);
      p.outro(color.red('Report generation failed'));
      process.exit(1);
    }

    if (options.open) openInBrowser(outputPath);

    p.outro(result.success ? color.green('PASS — report ready') : color.red('FAIL — report ready'));
  });
