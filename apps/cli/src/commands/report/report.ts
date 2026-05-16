import * as p from '@clack/prompts';
import color from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import type { TestResult } from '@tendo/core';
import { AgentRunner } from '@tendo/agent';
import { createProvider } from '../../agent/config.js';
import { generateReport } from '../../ReportGenerator.js';
import { readConfig } from '../config/config.js';

const SESSION_ROOT = path.join(os.homedir(), '.tendo', 'watch');

export interface ReportOptions {
  prompt?: string;
  watch?: boolean;
  viewport?: string;
  output?: string;
  open: boolean;
}

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
    if (!fs.existsSync(SESSION_ROOT)) throw new Error('No sessions found — run tendo report -p first');
    const sessions = fs.readdirSync(SESSION_ROOT)
      .filter(d => /^\d+$/.test(d))
      .sort((a, b) => Number(b) - Number(a));
    for (const session of sessions) {
      const found = findResultJson(path.join(SESSION_ROOT, session));
      if (found) return found;
    }
    throw new Error('No result.json found in any session');
  }

  if (/^\d+$/.test(id)) {
    const sessionDir = path.join(SESSION_ROOT, id);
    if (!fs.existsSync(sessionDir)) throw new Error(`Session ${id} not found at ${sessionDir}`);
    const found = findResultJson(sessionDir);
    if (!found) throw new Error(`No result.json in session ${id}`);
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

export async function runReport(id: string | undefined, options: ReportOptions): Promise<void> {
  p.intro(color.bgCyan(color.black(' Tendo Report ')));

  const cfg = readConfig();
  if (cfg) {
    p.log.info(color.dim(`config: provider=${cfg.provider ?? 'default'} viewport=${cfg.viewport ? `${cfg.viewport.width}×${cfg.viewport.height}` : 'default'}`));
  }

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
      provider = createProvider(cfg?.provider);
    } catch (error) {
      p.log.error((error as Error).message);
      p.outro(color.red('Report generation failed'));
      process.exit(1);
    }

    const viewport = options.viewport
      ? (() => { const [w, h] = options.viewport!.split(',').map(Number); return { width: w || 1920, height: h || 1080 }; })()
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

    if (sessionDir) {
      fs.writeFileSync(path.join(sessionDir, 'result.json'), JSON.stringify(result, null, 2));
      p.log.info(`${color.dim('Screenshots:')} ${color.cyan(sessionDir)}`);
    }

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

    p.log.info(`Source: ${color.dim(resultPath!)}`);

    try {
      result = JSON.parse(fs.readFileSync(resultPath!, 'utf-8'));
    } catch (error) {
      p.log.error(`Could not read result file: ${(error as Error).message}`);
      p.outro(color.red('Report generation failed'));
      process.exit(1);
    }

    outputPath = options.output
      ? resolveOutputPath(options.output)
      : defaultOutputPath(path.basename(path.dirname(resultPath!)));
  }

  // ── Generate & write HTML ────────────────────────────────────────
  const gs = p.spinner();
  gs.start('Generating report...');
  let html: string;
  try {
    html = generateReport(result!);
    gs.stop(`${color.green('✓')} Generated — ${result!.actions.length} steps, ${result!.screenshots?.length ?? 0} screenshots`);
  } catch (error) {
    gs.stop(`${color.red('✗')} Generation failed`);
    p.log.error((error as Error).message);
    p.outro(color.red('Report generation failed'));
    process.exit(1);
  }

  try {
    fs.writeFileSync(outputPath!, html!, 'utf-8');
    p.log.success(`Saved: ${color.cyan(outputPath!)}`);
  } catch (error) {
    p.log.error(`Could not write report: ${(error as Error).message}`);
    p.outro(color.red('Report generation failed'));
    process.exit(1);
  }

  if (options.open) openInBrowser(outputPath!);

  p.outro(result!.success ? color.green('PASS — report ready') : color.red('FAIL — report ready'));
}
