import { Command } from 'commander';
import { runConfigInit, runConfigShow } from './config.js';

export const configCommand = new Command()
  .name('config')
  .description('Manage tendo project configuration');

configCommand
  .command('init')
  .description('Create ~/.tendo/config.json with default scaffolding')
  .action(runConfigInit);

configCommand
  .command('show')
  .description('Show the current resolved configuration')
  .action(runConfigShow);
