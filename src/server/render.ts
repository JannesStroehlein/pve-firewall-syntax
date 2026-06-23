// Markdown rendering for hovers and completion documentation.

import { MacroInfo, MacroPort } from '../core/index';

function portLine(p: MacroPort): string {
  const parts: string[] = [];
  if (p.proto) parts.push(`proto ${p.proto}`);
  if (p.dport) parts.push(`dport ${p.dport}`);
  if (p.sport) parts.push(`sport ${p.sport}`);
  if (p['icmp-type']) parts.push(`icmp-type ${p['icmp-type']}`);
  return parts.join(', ');
}

/** Markdown documentation for a built-in macro. */
export function renderMacro(info: MacroInfo): string {
  const lines = [`**${info.name}** — ${info.desc}`, ''];
  if (info.code.length) {
    lines.push('Opens:');
    for (const p of info.code) lines.push(`- ${portLine(p)}`);
  }
  return lines.join('\n');
}
