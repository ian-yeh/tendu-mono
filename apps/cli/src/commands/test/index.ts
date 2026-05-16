import { Command } from 'commander';
import { runTest } from './test.js';

export const testCommand = new Command()
  .name('test')
  .description('Run a prompt-driven autonomous test against a URL')
  .argument('<url>', 'The URL to test')
  .requiredOption('-p, --prompt <prompt>', 'The test prompt')
  .option('--watch', 'Visible browser with per-step screenshots and verbose output')
  .option('--viewport <viewport>', 'Viewport size (W,H)')
  .option('-o, --output <file>', 'Save result to JSON file')
  .action(runTest);
