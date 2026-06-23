// pve-fw-check - standalone CLI checker. Shares the core engine with the language server.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Diagnostic, Resolver, parse, validate } from '../core/index';

interface Args {
  files: string[];
  format: 'text' | 'json';
  clusterPath?: string;
  node?: string;
  warnMissingCluster: boolean;
  quiet: boolean;
}

const USAGE = `Usage: pve-fw-check [options] <file.fw ...>

Check Proxmox VE firewall files for syntax errors and unresolved
aliases, IP sets and security groups.

Options:
  --format <text|json>   Output format (default: text)
  --cluster <path>       Path to cluster.fw for dc/ resolution
  --node <name>          Default node name for host.fw lookup
  --no-dc-warn           Suppress the "cluster.fw not found" hint
  --quiet                Only print errors and warnings, no summary
  -h, --help             Show this help

Exit codes: 0 = clean, 1 = errors found, 2 = bad usage`;

function parseArgs(argv: string[]): Args | { help: true } | { error: string } {
  const args: Args = {
    files: [],
    format: 'text',
    warnMissingCluster: true,
    quiet: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help':
        return { help: true };
      case '--format': {
        const v = argv[++i];
        if (v !== 'text' && v !== 'json')
          return { error: `--format expects text|json, got "${v}"` };
        args.format = v;
        break;
      }
      case '--cluster':
        args.clusterPath = argv[++i];
        if (!args.clusterPath) return { error: '--cluster expects a path' };
        break;
      case '--node':
        args.node = argv[++i];
        if (!args.node) return { error: '--node expects a name' };
        break;
      case '--no-dc-warn':
        args.warnMissingCluster = false;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      default:
        if (a.startsWith('-')) return { error: `Unknown option "${a}"` };
        args.files.push(a);
    }
  }
  if (args.files.length === 0) return { error: 'No input files' };
  return args;
}

interface FileResult {
  file: string;
  diagnostics: Diagnostic[];
}

function checkFile(file: string, resolver: Resolver, args: Args): FileResult {
  const abs = path.resolve(file);
  let text: string;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch {
    return {
      file,
      diagnostics: [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 }
          },
          severity: 'error',
          code: 'read-error',
          message: `Cannot read file "${file}".`
        }
      ]
    };
  }
  const doc = parse(text, abs);
  const ctx = resolver.build(abs, doc, {
    clusterPath: args.clusterPath,
    node: args.node
  });
  const diagnostics = validate(doc, ctx, {
    warnMissingCluster: args.warnMissingCluster
  });
  return { file, diagnostics };
}

const COLORS = {
  error: '\x1b[31m',
  warning: '\x1b[33m',
  info: '\x1b[36m',
  hint: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function printText(results: FileResult[], quiet: boolean): void {
  const color = process.stdout.isTTY;
  const c = (k: keyof typeof COLORS, s: string) =>
    color ? COLORS[k] + s + COLORS.reset : s;
  let errors = 0;
  let warnings = 0;
  for (const r of results) {
    if (r.diagnostics.length === 0) continue;
    process.stdout.write(
      `${color ? COLORS.bold : ''}${r.file}${color ? COLORS.reset : ''}\n`
    );
    for (const d of r.diagnostics) {
      if (d.severity === 'error') errors++;
      else if (d.severity === 'warning') warnings++;
      const loc = `${d.range.start.line + 1}:${d.range.start.character + 1}`;
      process.stdout.write(
        `  ${loc}  ${c(d.severity, d.severity.padEnd(7))} ${d.code.padEnd(20)} ${d.message}\n`
      );
    }
  }
  if (!quiet) {
    const clean = results.filter((r) => r.diagnostics.length === 0).length;
    process.stdout.write(
      `\n${results.length} file(s): ${clean} clean, ${errors} error(s), ${warnings} warning(s).\n`
    );
  }
}

function printJson(results: FileResult[]): void {
  process.stdout.write(JSON.stringify({ files: results }, null, 2) + '\n');
}

export function main(argv = process.argv.slice(2)): number {
  const parsed = parseArgs(argv);
  if ('help' in parsed) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  if ('error' in parsed) {
    process.stderr.write(`pve-fw-check: ${parsed.error}\n\n${USAGE}\n`);
    return 2;
  }
  const resolver = new Resolver();
  const results = parsed.files.map((f) => checkFile(f, resolver, parsed));
  if (parsed.format === 'json') printJson(results);
  else printText(results, parsed.quiet);

  const hasError = results.some((r) =>
    r.diagnostics.some((d) => d.severity === 'error')
  );
  return hasError ? 1 : 0;
}

if (require.main === module) {
  process.exit(main());
}
