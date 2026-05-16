import * as p from '@clack/prompts';
import color from 'picocolors';
import fs from 'fs';
import { createProvider } from '../../agent/config.js';
import { readConfig } from '../config/config.js';
import { runAgentWithUI } from '../shared.js';

export interface TestOptions {
  prompt: string;
  watch?: boolean;
  viewport?: string;
  output?: string;
}

export async function runTest(url: string, options: TestOptions): Promise<void> {
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

  const viewport = options.viewport
    ? (() => { const [w, h] = options.viewport!.split(',').map(Number); return { width: w || 1920, height: h || 1080 }; })()
    : (cfg?.viewport ?? { width: 1920, height: 1080 });

  let result;
  try {
    ({ result } = await runAgentWithUI({
      url,
      prompt: options.prompt,
      provider,
      viewport,
      headless: !options.watch,
      watch: options.watch,
    }));
  } catch (error) {
    p.log.error(color.red(`Fatal error: ${(error as Error).message}`));
    p.outro('Test aborted.');
    process.exit(1);
  }

  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
    p.log.success(`Results saved to ${color.cyan(options.output)}`);
  }

  p.log.message('');
  p.log.message(`Status:     ${result.success ? color.green('PASS') : color.red('FAIL')}`);
  p.log.message(`Steps taken: ${result.steps}`);

  p.outro(result.success ? 'Test completed successfully' : 'Test failed');
  process.exit(result.success ? 0 : 1);
}
