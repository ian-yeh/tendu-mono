import { Command } from 'commander';
import { runReport } from './report.js';

export const reportCommand = new Command()
  .name('report')
  .description('Run a test and generate an HTML report, or report from a saved result')
  .argument('[id]', 'URL (with -p), path to result.json, session number, or omit for latest')
  .option('-p, --prompt <prompt>', 'Run a live test against the URL')
  .option('--watch', 'Visible browser with per-step screenshots and verbose output')
  .option('--viewport <viewport>', 'Viewport size when running live (W,H)')
  .option('-o, --output <file>', 'Output HTML file path')
  .option('--no-open', 'Do not open the report in a browser')
  .action(runReport);
