#!/usr/bin/env node

import { Command } from 'commander';
import { citeCommand } from './commands/cite.js';
import { showCommand } from './commands/show.js';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));

const program = new Command();

program
    .name('scs')
    .description('Software Citation Station CLI')
    .version(packageJson.version);

program.addCommand(citeCommand);
program.addCommand(showCommand);

program.parse();
