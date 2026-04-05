#!/usr/bin/env node

import { Command } from 'commander';
import * as p from '@clack/prompts';
import color from 'picocolors';

const program = new Command();

program
  .name('tendu')
  .description('Tendu CLI')
  .version('1.0.0');

program
  .command('hello')
  .description('Say hello to a name')
  .argument('<name>', 'The name to greet')
  .action((name) => {
    //p.intro(`${color.bgCyan(color.black(' testpilot-cli '))}`);
    p.log.step(`Hello, ${color.cyan(name)}!`);
    p.outro(color.green('Greeted successfully.'));
  });

program
  .command('bye')
  .description('Say goodbye to a name')
  .argument('<name>', 'The name to say goodbye to')
  .action((name) => {
    //p.intro(`${color.bgCyan(color.black(' testpilot-cli '))}`);
    p.log.step(`Goodbye, ${color.cyan(name)}!`);
    p.outro(color.green('Said goodbye successfully.'));
  });

program.parse();
