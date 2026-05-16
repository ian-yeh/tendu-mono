import * as p from '@clack/prompts';
import color from 'picocolors';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CONFIG_DIR = path.join(os.homedir(), '.tendo');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const SCAFFOLD = {
  secrets: {
    email: '$TEST_EMAIL',
    password: '$TEST_PASSWORD',
  },
  viewport: { width: 1280, height: 800 },
  maxSteps: 30,
  provider: 'gemini',
};

export interface TendoConfig {
  secrets?: Record<string, string>;
  viewport?: { width: number; height: number };
  maxSteps?: number;
  provider?: string;
}

export function readConfig(): TendoConfig | null {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as TendoConfig;
  } catch {
    return null;
  }
}

export async function runConfigInit(): Promise<void> {
  p.intro(color.bgCyan(color.black(' Tendo Config Init ')));

  if (fs.existsSync(CONFIG_PATH)) {
    const overwrite = await p.confirm({
      message: `${CONFIG_PATH} already exists. Overwrite?`,
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.outro('Aborted.');
      return;
    }
  }

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(SCAFFOLD, null, 2) + '\n', { mode: 0o600 });

  p.log.success(`Created ${color.cyan(CONFIG_PATH)}`);
  p.log.info(`Edit the file to set your target URL, secrets, and provider.`);
  p.outro('Done');
}

export function runConfigShow(): void {
  p.intro(color.bgCyan(color.black(' Tendo Config ')));

  if (!fs.existsSync(CONFIG_PATH)) {
    p.log.warn(`No config found at ${color.cyan(CONFIG_PATH)}`);
    p.log.info(`Run ${color.yellow('tendo config init')} to create one.`);
    p.outro('');
    return;
  }

  let cfg: TendoConfig;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    p.log.error(`Failed to parse ${CONFIG_PATH} — check for JSON syntax errors.`);
    p.outro('');
    process.exit(1);
  }

  p.log.info(`Config: ${color.dim(CONFIG_PATH)}`);
  p.log.message('');
  p.log.message(`  ${color.bold('provider')}  ${cfg.provider ?? color.dim('—')}`);
  p.log.message(`  ${color.bold('maxSteps')}  ${cfg.maxSteps ?? color.dim('—')}`);
  p.log.message(
    `  ${color.bold('viewport')}  ${cfg.viewport ? `${cfg.viewport.width} × ${cfg.viewport.height}` : color.dim('—')}`
  );

  const secrets = cfg.secrets ?? {};
  if (Object.keys(secrets).length > 0) {
    p.log.message('');
    p.log.message(`  ${color.bold('secrets')}`);
    for (const [key, ref] of Object.entries(secrets)) {
      if (typeof ref === 'string' && ref.startsWith('$')) {
        const envKey = ref.slice(1);
        const isSet = Boolean(process.env[envKey]);
        const status = isSet ? color.green('✓ set') : color.red('✗ not set');
        p.log.message(`    ${color.dim(key)}  ${color.dim(ref)}  ${status}`);
      } else {
        p.log.message(`    ${color.dim(key)}  ${ref}`);
      }
    }
  }

  p.outro('');
}
