// Generate src/core/macros.generated.ts from the vendored upstream macros.json.
// Source: proxmox-ve-rs / proxmox-ve-config/resources/macros.json
// Run: npm run gen:macros (also runs automatically on prebuild/pretest).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'resources', 'macros.json');
const out = join(root, 'src', 'core', 'macros.generated.ts');

const raw = JSON.parse(readFileSync(src, 'utf8'));

// Preserve only known fields, in a stable order, with sorted macro names.
const FIELDS = ['proto', 'dport', 'sport', 'icmp-type'];
const entries = Object.keys(raw)
  .sort((a, b) => a.localeCompare(b))
  .map((name) => {
    const desc = raw[name].desc ?? '';
    const code = (raw[name].code ?? []).map((c) => {
      const o = {};
      for (const f of FIELDS) if (c[f] !== undefined) o[f] = c[f];
      return o;
    });
    return { name, desc, code };
  });

const body = entries
  .map(
    (e) =>
      `  ${JSON.stringify(e.name)}: ${JSON.stringify({ name: e.name, desc: e.desc, code: e.code })},`
  )
  .join('\n');

const ts = `// AUTO-GENERATED - do not edit. Run \`npm run gen:macros\`.
// Source: proxmox-ve-rs proxmox-ve-config/resources/macros.json (vendored in resources/).
import { MacroInfo } from "./model";

export const MACRO_INFO: Record<string, MacroInfo> = {
${body}
};

export const MACROS: string[] = Object.keys(MACRO_INFO);
`;

writeFileSync(out, ts);
console.log(`gen-macros: wrote ${entries.length} macros -> ${out}`);
