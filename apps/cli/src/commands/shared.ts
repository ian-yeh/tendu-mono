import * as p from '@clack/prompts';
import color from 'picocolors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentRunner } from '@tendo/agent';
import type { TestResult } from '@tendo/core';
import type { LLMProvider } from '@tendo/core';

const SESSION_ROOT = path.join(os.homedir(), '.tendo', 'watch');

export interface AgentRunOptions {
  url: string;
  prompt: string;
  provider: LLMProvider;
  viewport?: { width: number; height: number };
  headless?: boolean;
  watch?: boolean;
}

export async function runAgentWithUI(options: AgentRunOptions): Promise<{
  result: TestResult;
  sessionDir?: string;
}> {
  let targetUrl = options.url;
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = `https://${targetUrl}`;

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

  const runner = new AgentRunner(options.provider);
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

  const finalState = await runner.run({
    url: targetUrl,
    prompt: options.prompt,
    headless: options.headless !== false,
    viewport: options.viewport ?? { width: 1920, height: 1080 },
  });

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

  return { result, sessionDir };
}
