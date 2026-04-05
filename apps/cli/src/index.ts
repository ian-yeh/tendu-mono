#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('hello world');
  process.exit(0);
}

// Default behavior when no --help flag is provided
console.log('TestPilot CLI');
console.log('Use --help for help');
