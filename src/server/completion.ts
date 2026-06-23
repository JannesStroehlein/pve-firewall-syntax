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
import { renderAlias, renderGroup, renderIpset, renderMacro } from './render';

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

function stripMdControlChars(mdString: string): string {
  return mdString.replaceAll(/\*\*|\*|_/g, '');
}

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
  // Datacenter symbols are referenced bare (the dc/ prefix is optional and local
  // names shadow them), so suggest bare labels and let local definitions win.
  const aliasSeen = new Set<string>();
  const ipsetSeen = new Set<string>();

  for (const a of ctx.local.aliases.values()) {
    aliasSeen.add(a.name);
    out.push(
      item(
        a.name,
        CompletionItemKind.Variable,
        stripMdControlChars(renderAlias(a.name, a))
      )
    );
  }
  for (const s of ctx.local.ipsets.values()) {
    ipsetSeen.add(s.name);
    out.push(
      item(
        `+${s.name}`,
        CompletionItemKind.Reference,
        stripMdControlChars(renderIpset(s.name, s))
      )
    );
  }

  if (withDc) {
    for (const a of ctx.dc.aliases.values()) {
      if (aliasSeen.has(a.name)) continue;
      out.push(
        item(
          a.name,
          CompletionItemKind.Variable,
          stripMdControlChars(renderAlias(a.name, a))
        )
      );
    }
    for (const s of ctx.dc.ipsets.values()) {
      if (ipsetSeen.has(s.name)) continue;
      out.push(
        item(
          `+${s.name}`,
          CompletionItemKind.Reference,
          stripMdControlChars(renderIpset(s.name, s))
        )
      );
    }
  }
  return out;
}

function groupItems(ctx: ResolutionContext): CompletionItem[] {
  const out: CompletionItem[] = [];
  const seen = new Set<string>();
  for (const g of [...ctx.local.groups.values(), ...ctx.dc.groups.values()]) {
    if (seen.has(g.name)) continue;
    seen.add(g.name);
    out.push(item(g.name, CompletionItemKind.Class, renderGroup(g.name, g)));
  }
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
    const allTokens = trimmed.split(/\s+/).filter(Boolean);
    const partial = endsWithSpace ? '' : (allTokens[allTokens.length - 1] ?? '');
    // Tokens fully entered to the left of the one being typed.
    const completed = endsWithSpace ? allTokens : allTokens.slice(0, -1);

    switch (expectedCategory(completed)) {
      case 'start':
        return [
          ...directionItems(),
          item('GROUP', CompletionItemKind.Keyword, 'group reference')
        ];
      case 'groupName':
        return groupItems(ctx);
      case 'macroOrAction':
        return [...macroItems(), ...actionItems()];
      case 'flag':
        return flagItems();
      case 'proto':
        return protocolItems();
      case 'loglevel':
        return logLevelItems();
      case 'address': {
        const items = aliasAndIpsetItems(ctx, true);
        // `+` forces an IP set; bare allows aliases and IP sets.
        return partial.startsWith('+')
          ? items.filter((i) => i.label.startsWith('+'))
          : items;
      }
      // port / icmptype / iface / end -> free text, nothing to suggest.
      default:
        return [];
    }
  }

  return [];
}

/** Category of token expected next in a firewall rule, given the tokens before it. */
type RuleCategory =
  | 'start' // direction or GROUP
  | 'groupName'
  | 'macroOrAction'
  | 'flag'
  | 'proto'
  | 'port'
  | 'address'
  | 'loglevel'
  | 'icmptype'
  | 'iface'
  | 'end';

// Value category each flag expects after it.
const FLAG_VALUE: Record<string, RuleCategory> = {
  '-p': 'proto',
  '-proto': 'proto',
  '-dport': 'port',
  '-sport': 'port',
  '-source': 'address',
  '-dest': 'address',
  '-log': 'loglevel',
  '-icmp-type': 'icmptype',
  '-i': 'iface',
  '-iface': 'iface',
  '-o': 'iface'
};

/**
 * Walk the rule grammar over the already-entered tokens and return what the next
 * token must be. This is the predict set:
 *   rule := '|'? (GROUP name | DIRECTION (MACRO '(' ACTION ')' | ACTION) flag*)
 *   flag := '-name' value?
 */
function expectedCategory(tokens: string[]): RuleCategory {
  let state: RuleCategory = 'start';
  for (const tok of tokens) {
    switch (state) {
      case 'start':
        if (tok === '|') break; // disabled-rule marker, still at start
        state = tok === 'GROUP' ? 'groupName' : 'macroOrAction';
        break;
      case 'groupName':
        state = 'end';
        break;
      case 'macroOrAction':
        state = 'flag';
        break;
      case 'flag':
        // A flag either consumes a value next, or (valueless) stays at flag.
        state = FLAG_VALUE[tok] ?? 'flag';
        break;
      case 'proto':
      case 'port':
      case 'address':
      case 'loglevel':
      case 'icmptype':
      case 'iface':
        state = 'flag'; // value consumed, back to expecting flags
        break;
      case 'end':
        break;
    }
  }
  return state;
}
