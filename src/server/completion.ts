// Context-aware completion for PVE firewall files.

import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
  Position
} from 'vscode-languageserver';
import {
  ACTIONS,
  DIRECTIONS,
  LOG_LEVELS,
  MACRO_INFO,
  MACROS,
  OPTION_KEYS,
  PROTOCOLS,
  RULE_FLAGS,
  ResolutionContext,
  SECTION_NAMES
} from '../core/index';
import { renderMacro } from './render';

const item = (
  label: string,
  kind: CompletionItemKind,
  detail?: string,
  insertText?: string
): CompletionItem => ({
  label,
  kind,
  detail,
  insertText
});

/** Determine the section kind that owns `line` by scanning headers above it. */
function sectionAt(
  lines: string[],
  line: number
): { kind: string; name?: string } {
  for (let i = Math.min(line, lines.length - 1); i >= 0; i--) {
    const m = /^\s*\[\s*(\w+)(?:\s+(\S+))?\s*\]/.exec(lines[i]);
    if (m) {
      const upper = m[1].toUpperCase();
      if (['OPTIONS', 'RULES', 'ALIASES', 'IPSET', 'GROUP'].includes(upper))
        return { kind: upper, name: m[2] };
      return { kind: 'unknown' };
    }
  }
  return { kind: 'none' };
}

const directionItems = () =>
  DIRECTIONS.map((d) => item(d, CompletionItemKind.Keyword, 'direction'));
const actionItems = () =>
  ACTIONS.map((a) => item(a, CompletionItemKind.Constant, 'action'));
const macroItems = () =>
  MACROS.map((m) => {
    const info = MACRO_INFO[m];
    const it = item(
      m,
      CompletionItemKind.Function,
      info?.desc ?? 'macro',
      `${m}()`
    );
    if (info)
      it.documentation = {
        kind: MarkupKind.Markdown,
        value: renderMacro(info)
      };
    return it;
  });
const flagItems = () =>
  RULE_FLAGS.map((f) => item(f, CompletionItemKind.Property, 'rule option'));
const protocolItems = () =>
  PROTOCOLS.map((p) => item(p, CompletionItemKind.Value, 'protocol'));
const logLevelItems = () =>
  LOG_LEVELS.map((l) => item(l, CompletionItemKind.Value, 'log level'));

function aliasAndIpsetItems(
  ctx: ResolutionContext,
  withDc: boolean
): CompletionItem[] {
  const out: CompletionItem[] = [];
  for (const a of ctx.local.aliases.values())
    out.push(
      item(a.name, CompletionItemKind.Variable, `alias → ${a.value ?? ''}`)
    );
  for (const s of ctx.local.ipsets.values())
    out.push(item(`+${s.name}`, CompletionItemKind.Reference, 'IP set'));
  if (withDc) {
    for (const a of ctx.dc.aliases.values())
      out.push(
        item(
          `dc/${a.name}`,
          CompletionItemKind.Variable,
          `dc alias → ${a.value ?? ''}`
        )
      );
    for (const s of ctx.dc.ipsets.values())
      out.push(
        item(`+dc/${s.name}`, CompletionItemKind.Reference, 'dc IP set')
      );
  }
  return out;
}

function groupItems(ctx: ResolutionContext): CompletionItem[] {
  const out: CompletionItem[] = [];
  for (const g of ctx.local.groups.values())
    out.push(item(g.name, CompletionItemKind.Class, 'security group'));
  for (const g of ctx.dc.groups.values())
    out.push(item(g.name, CompletionItemKind.Class, 'security group'));
  return out;
}

export function complete(
  text: string,
  pos: Position,
  ctx: ResolutionContext
): CompletionItem[] {
  const lines = text.split(/\r?\n/);
  const lineText = lines[pos.line] ?? '';
  const prefix = lineText.slice(0, pos.character);
  const trimmed = prefix.replace(/^\s+/, '');

  // Section header.
  if (trimmed.startsWith('[')) {
    return SECTION_NAMES.map((s) =>
      item(s, CompletionItemKind.Module, 'section')
    );
  }

  const { kind } = sectionAt(lines, pos.line);

  if (kind === 'OPTIONS') {
    const colon = prefix.indexOf(':');
    if (colon === -1) {
      return Object.keys(OPTION_KEYS).map((k) =>
        item(k, CompletionItemKind.Property, 'option')
      );
    }
    const key = prefix.slice(0, colon).trim();
    const valueKind = OPTION_KEYS[key];
    if (valueKind === 'bool')
      return ['0', '1'].map((v) => item(v, CompletionItemKind.Value));
    if (valueKind === 'policy')
      return ACTIONS.map((v) => item(v, CompletionItemKind.Value));
    if (valueKind === 'policy-fwd')
      return ['ACCEPT', 'DROP'].map((v) => item(v, CompletionItemKind.Value));
    if (valueKind === 'loglevel') return logLevelItems();
    return [];
  }

  if (kind === 'RULES' || kind === 'GROUP' || kind === 'unknown') {
    const endsWithSpace = /\s$/.test(prefix);
    const tokens = trimmed.length ? trimmed.split(/\s+/) : [];
    const partial = endsWithSpace ? '' : (tokens[tokens.length - 1] ?? '');
    const prev = endsWithSpace
      ? tokens[tokens.length - 1]
      : tokens[tokens.length - 2];

    // First token on the line.
    if (tokens.length === 0 || (tokens.length === 1 && !endsWithSpace)) {
      return [
        ...directionItems(),
        item('GROUP', CompletionItemKind.Keyword, 'group reference')
      ];
    }

    if (partial.startsWith('+'))
      return aliasAndIpsetItems(ctx, true).filter((i) =>
        i.label.startsWith('+')
      );
    if (partial.startsWith('-')) return flagItems();

    if (prev === '-source' || prev === '-dest')
      return aliasAndIpsetItems(ctx, true);
    if (prev === '-p' || prev === '-proto') return protocolItems();
    if (prev === '-log') return logLevelItems();
    if (prev && DIRECTIONS.includes(prev as (typeof DIRECTIONS)[number]))
      return [...macroItems(), ...actionItems()];
    if (prev === 'GROUP') return groupItems(ctx);

    // General continuation.
    return [...actionItems(), ...flagItems()];
  }

  return [];
}
