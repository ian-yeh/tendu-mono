import { Command } from 'commander';
import * as p from '@clack/prompts';
import color from 'picocolors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentRunner } from '@tendo/agent';
import type { TestResult } from '@tendo/core';
import { createProvider } from '../agent/config.js';
import { readConfig } from './config.js';

const SESSION_ROOT = path.join(os.homedir(), '.tendo', 'watch');

export const testCommand = new Command()
  .name('test')
  .description('Run a prompt-driven autonomous test against a URL')
  .argument('<url>', 'The URL to test')
  .requiredOption('-p, --prompt <prompt>', 'The test prompt')
  .option('--watch', 'Visible browser with per-step screenshots and verbose output')
  .option('--viewport <viewport>', 'Viewport size (W,H)')
  .option('-o, --output <file>', 'Save result to JSON file')
  .action(async (url: string, options) => {
    p.intro(color.bgCyan(color.black(' Tendo QA Agent ')));

    const cfg = readConfig();
    if (cfg) {
      p.log.info(color.dim(`config: provider=${cfg.provider ?? 'default'} viewport=${cfg.viewport ? `${cfg.viewport.width}×${cfg.viewport.height}` : 'default'}`));
    }

    let provider;
    try {
      provider = createProvider(cfg?.provider);
    } catch (error) {
      p.log.error(color.red((error as Error).message));
      p.outro('Test aborted.');
      process.exit(1);
    }

    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;

    const viewport = options.viewport
      ? (() => { const [w, h] = options.viewport.split(',').map(Number); return { width: w || 1920, height: h || 1080 }; })()
      : (cfg?.viewport ?? { width: 1920, height: 1080 });

    let sessionDir: string | undefined;
    if (options.watch) {
      fs.mkdirSync(SESSION_ROOT, { recursive: true });
      const existingSessions = fs.readdirSync(SESSION_ROOT).filter(d => /^\d+$/.test(d));
      const sessionNum = existingSessions.length > 0
        ? Math.max(...existingSessions.map(Number)) + 1
        : 1;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      sessionDir = path.join(SESSION_ROOT, String(sessionNum), timestamp);
      fs.mkdirSync(sessionDir, { recursive: true });
    }

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

    runner.on('step:decision', ({ step, thought, action, screenshotBase64 }: {
      step: number;
      thought: string;
      action: { type: string; x?: number; y?: number; text?: string; reason?: string };
      screenshotBase64: string;
    }) => {
      s.stop(`Step ${step}: ${color.bold(action.type.toUpperCase())}`);

      if (sessionDir) {
        const screenshotPath = path.join(sessionDir, `step-${String(step).padStart(2, '0')}.png`);
        fs.writeFileSync(screenshotPath, Buffer.from(screenshotBase64, 'base64'));
        p.log.info(color.dim(`  Thought: ${thought}`));
        if (action.x != null && action.y != null) {
          p.log.info(color.dim(`  Coords:  (${action.x}, ${action.y})`));
        }
        if (action.text) {
          p.log.info(color.dim(`  Text:    "${action.text}"`));
        }
        if (action.reason) {
          p.log.info(color.dim(`  Reason:  ${action.reason}`));
        }
        p.log.message('');
      } else {
        p.log.info(color.dim(`Thought: ${thought}`));
        if (action.reason) p.log.info(color.dim(`Reason: ${action.reason}`));
      }
    });

    runner.on('error', ({ step, error }: { step: number; error: Error }) => {
      s.stop(`Step ${step} failed`);
      p.log.error(color.red(`  Error: ${error.message}`));
    });

    let finalState;
    try {
      finalState = await runner.run({
        url: targetUrl,
        prompt: options.prompt,
        headless: !options.watch,
        viewport,
      });
    } catch (error) {
      p.log.error(color.red(`Fatal error: ${(error as Error).message}`));
      p.outro('Test aborted.');
      process.exit(1);
    }

    const result: TestResult = {
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

    if (sessionDir) {
      fs.writeFileSync(path.join(sessionDir, 'result.json'), JSON.stringify(result, null, 2));
      p.log.info(`${color.dim('Screenshots:')} ${color.cyan(sessionDir)}`);
    }

    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
      p.log.success(`Results saved to ${color.cyan(options.output)}`);
    }

    p.log.message('');
    p.log.message(`Status:     ${finalState.success ? color.green('PASS') : color.red('FAIL')}`);
    p.log.message(`Steps taken: ${finalState.step}`);

    p.outro(finalState.success ? 'Test completed successfully' : 'Test failed');
    process.exit(finalState.success ? 0 : 1);
  });
