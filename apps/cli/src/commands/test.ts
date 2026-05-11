import { Command } from 'commander';
import * as p from '@clack/prompts';
import color from 'picocolors';
import { AgentRunner } from '@tendo/agent';
import type { TestResult } from '@tendo/core';
import { createProvider } from '../agent/config.js';
import { readConfig } from './config.js';

export const testCommand = new Command()
  .name('test')
  .description('Run a prompt-driven autonomous test against a URL')
  .argument('<url>', 'The URL to test')
  .requiredOption('-p, --prompt <prompt>', 'The test prompt')
  .option('--headless', 'Run browser in headless mode', true)
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

    const runner = new AgentRunner(provider);
    const s = p.spinner();

    runner.on('init', () => {
      p.log.info(`Testing: ${color.cyan(targetUrl)}`);
      p.log.info(`Prompt: "${color.yellow(options.prompt)}"`);
    });

    runner.on('step:start', ({ step }) => {
      s.start(`Step ${step}: Analyzing page...`);
    });

    runner.on('step:decision', ({ step, thought, action }) => {
      s.stop(`Step ${step}: ${action.type.toUpperCase()}`);
      p.log.info(color.dim(`Thought: ${thought}`));
      if (action.reason) p.log.info(color.dim(`Reason: ${action.reason}`));
    });

    runner.on('error', ({ step, error }) => {
      s.stop(`Step ${step} failed`);
      p.log.error(`Error: ${error.message}`);
    });

    let finalState;
    try {
      finalState = await runner.run({
        url: targetUrl,
        prompt: options.prompt,
        headless: options.headless,
        viewport
      });
    } catch (error) {
      p.log.error(color.red(`Fatal error: ${(error as Error).message}`));
      p.outro('Test aborted.');
      process.exit(1);
    }

    p.log.message('');
    p.log.info(color.bold('Test Result:'));
    p.log.message(`Status: ${finalState.success ? color.green('PASS') : color.red('FAIL')}`);
    p.log.message(`Steps taken: ${finalState.step}`);

    if (options.output) {
      const result: TestResult = {
        success: finalState.success,
        url: targetUrl,
        prompt: options.prompt,
        steps: finalState.step,
        actions: finalState.actions.flatMap(a => {
          try { return [JSON.parse(a)]; } catch { return []; }
        }),
        finalUrl: finalState.currentUrl,
        timestamp: new Date().toISOString(),
        screenshots: finalState.screenshots,
      };
      const fs = await import('fs');
      fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
      p.log.success(`Results saved to ${options.output}`);
    }

    p.outro(finalState.success ? 'Test completed successfully' : 'Test failed');
    process.exit(finalState.success ? 0 : 1);
  });
