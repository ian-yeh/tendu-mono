#!/usr/bin/env node

import 'dotenv/config';

import { Command } from 'commander';

import { testCommand } from './commands/test/index.js';
import { reportCommand } from './commands/report/index.js';
import { configCommand } from './commands/config/index.js';

const program = new Command();

program
  .name('tendo')
  .description('Tendo CLI — autonomous QA agent for UX flow testing')
  .version('1.0.0');

program.addCommand(testCommand);
program.addCommand(reportCommand);
program.addCommand(configCommand);

program.parse();
