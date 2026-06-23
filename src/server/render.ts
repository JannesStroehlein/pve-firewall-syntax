// Markdown rendering for hovers and completion documentation.

import { MacroInfo, MacroPort, SymbolDef } from '../core/index';

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
  const lines = [`**${info.name}** - ${info.desc}`, ''];
  if (info.code.length) {
    lines.push('Opens:');
    for (const p of info.code) lines.push(`- ${portLine(p)}`);
  }
  return lines.join('\n');
}

const cmt = (c?: string) => (c ? `_${c}_` : '');

/** Hover markdown for an alias reference. */
export function renderAlias(label: string, def?: SymbolDef): string {
  if (!def) return `**${label}** - unresolved alias`;

  const lines = [`**${label}** - alias -> \`${def.value ?? ''}\``];
  if (def.comment) {
    lines.push('');
    lines.push(cmt(def.comment));
  }

  return lines.join('\n');
}

/** Hover markdown for an IP set reference, listing its members. */
export function renderIpset(label: string, def?: SymbolDef): string {
  if (!def) return `**${label}** - unresolved IP set`;

  const lines = [`**${label}** - IP set`];
  if (def.comment) {
    lines.push('');
    lines.push(cmt(def.comment));
  }

  const members = def.members ?? [];
  if (members.length) {
    lines.push('');
    for (const m of members) {
      lines.push(`- \`${m.negated ? '!' : ''}${m.value}\` - ${cmt(m.comment)}`);
    }
  } else {
    lines.push('', '_(no members)_');
  }
  return lines.join('\n');
}

/** Hover markdown for a security group reference, listing its rules. */
export function renderGroup(name: string, def?: SymbolDef): string {
  if (!def) return `**${name}** - unresolved security group`;

  const lines = [`**${name}** - security group`];
  if (def.comment) {
    lines.push('');
    lines.push(cmt(def.comment));
  }

  const rules = def.groupRules ?? [];
  if (rules.length) {
    lines.push('');
    for (const r of rules) {
      lines.push(`- \`${r.raw}\`${cmt(r.comment)}`);
    }
  }
  return lines.join('\n');
}
