import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  platform: 'node',
  target: 'node16',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info'
};

const targets = [
  // VSCode extension client - vscode is provided by the host, keep external.
  {
    entryPoints: ['src/client/extension.ts'],
    outfile: 'dist/extension.js',
    external: ['vscode']
  },
  // Language server - runs in its own Node process, no vscode runtime.
  {
    entryPoints: ['src/server/server.ts'],
    outfile: 'dist/server.js',
    external: []
  },
  // Standalone CLI.
  {
    entryPoints: ['src/cli/cli.ts'],
    outfile: 'dist/cli.js',
    external: [],
    banner: { js: '#!/usr/bin/env node' }
  }
];

if (watch) {
  for (const t of targets) {
    const ctx = await context({ ...common, ...t });
    await ctx.watch();
  }
} else {
  await Promise.all(targets.map((t) => build({ ...common, ...t })));
}
