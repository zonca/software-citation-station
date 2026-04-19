#!/usr/bin/env node

/**
 * SCS CLI - Software Citation Station Command Line Interface
 * 
 * Usage:
 *   scs cite [options] [packages...]  Generate citations for software packages
 *   scs show [options] <package>      Display detailed package information
 */

import { Command } from 'commander';
import { citeCommand } from './commands/cite.js';
import { showCommand } from './commands/show.js';

// Read version from package.json
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

const program = new Command();

program
  .name('scs')
  .description('Software Citation Station CLI - Generate citations for research software')
  .version(packageJson.version);

program.addCommand(citeCommand);
program.addCommand(showCommand);

// Add some helpful examples
program.addHelpText('after', `

Examples:
  $ scs cite numpy scipy
  $ scs cite astropy==6.0.1
  $ scs cite astropy[fitting,io]
  $ scs cite numpy scipy==1.17.1 --json
  $ scs show astropy
  $ scs cite numpy --refresh-cache
`);

program.parse();
