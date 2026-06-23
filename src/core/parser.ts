// Tolerant line-based parser for PVE firewall (.fw) files.
// Never throws — structural problems become parseDiagnostics. Records precise ranges.

import {
  AliasDef,
  Diagnostic,
  FwDocument,
  IpsetEntry,
  OptionEntry,
  Range,
  Rule,
  RuleRef,
  Section,
  SectionKind,
  rangeFrom
} from './model';

const RE_IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const RE_CIDR = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;
const RE_RANGE = /^\d{1,3}(\.\d{1,3}){3}-\d{1,3}(\.\d{1,3}){3}$/;
const RE_IDENT = /^[A-Za-z_][\w.-]*$/;
const RE_DIRECTIVE = /^#\s*pve-fw:\s*(\w+)\s*=\s*(\S+)\s*$/i;

interface Token {
  text: string;
  start: number;
  end: number;
}

/** Split `text` (a slice of `raw` starting at `base`) into whitespace-delimited tokens. */
function tokenize(text: string, base: number): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({
      text: m[0],
      start: base + m.index,
      end: base + m.index + m[0].length
    });
  }
  return out;
}

/** Strip an inline `# comment`. Returns the code portion (right-padded preserved by index). */
function stripComment(raw: string): { code: string } {
  const hash = raw.indexOf('#');
  if (hash === -1) return { code: raw };
  return { code: raw.slice(0, hash) };
}

function classifyRef(
  item: string,
  line: number,
  start: number,
  flag: string,
  rule: Rule
): void {
  const end = start + item.length;
  const range = rangeFrom(line, start, end);
  if (item.startsWith('+')) {
    const body = item.slice(1);
    const dc = body.startsWith('dc/');
    rule.refs.push({
      kind: 'ipset',
      dc,
      name: dc ? body.slice(3) : body,
      range
    });
    return;
  }
  if (RE_IPV4.test(item) || RE_CIDR.test(item) || RE_RANGE.test(item)) {
    rule.literals.push({ text: item, range, context: 'ip' });
    return;
  }
  if (item.startsWith('dc/')) {
    rule.refs.push({ kind: 'alias', dc: true, name: item.slice(3), range });
    return;
  }
  if (RE_IDENT.test(item)) {
    // Bare identifier in a -source/-dest position → local alias reference.
    if (flag === '-source' || flag === '-dest') {
      rule.refs.push({ kind: 'alias', dc: false, name: item, range });
      return;
    }
  }
  // Anything else in an address position is a malformed literal; let validator flag it.
  if (flag === '-source' || flag === '-dest') {
    rule.literals.push({ text: item, range, context: 'ip' });
  }
}

/** Classify each comma-separated part of a flag value. */
function scanFlagValue(
  value: string,
  base: number,
  line: number,
  flag: string,
  rule: Rule
): void {
  let offset = 0;
  for (const part of value.split(',')) {
    const trimmedStart = offset + (part.length - part.trimStart().length);
    const item = part.trim();
    if (item) {
      if (flag === '-dport' || flag === '-sport') {
        rule.literals.push({
          text: item,
          range: rangeFrom(
            line,
            base + trimmedStart,
            base + trimmedStart + item.length
          ),
          context: 'port'
        });
      } else {
        classifyRef(item, line, base + trimmedStart, flag, rule);
      }
    }
    offset += part.length + 1; // +1 for the comma
  }
}

const RE_MACRO_ACTION = /^([A-Za-z][\w]*)\((ACCEPT|DROP|REJECT)\)$/;
const RE_BARE_ACTION = /^(ACCEPT|DROP|REJECT)$/;
const FLAGS_WITH_VALUE = new Set([
  '-p',
  '-proto',
  '-dport',
  '-sport',
  '-source',
  '-dest',
  '-i',
  '-iface',
  '-o',
  '-log',
  '-icmp-type'
]);

function parseRule(code: string, line: number): Rule {
  const rule: Rule = {
    line,
    disabled: false,
    flags: [],
    refs: [],
    literals: []
  };
  let toks = tokenize(code, 0);
  if (toks.length === 0) return rule;

  // Leading `|` marks a disabled rule; it may be attached to the first token.
  if (toks[0].text === '|') {
    rule.disabled = true;
    toks = toks.slice(1);
  } else if (toks[0].text.startsWith('|')) {
    rule.disabled = true;
    const t = toks[0];
    toks[0] = { text: t.text.slice(1), start: t.start + 1, end: t.end };
  }
  if (toks.length === 0) return rule;

  // GROUP reference line.
  if (toks[0].text === 'GROUP') {
    if (toks[1])
      rule.groupRef = {
        name: toks[1].text,
        range: rangeFrom(line, toks[1].start, toks[1].end)
      };
    return rule;
  }

  let i = 0;
  // Direction.
  rule.direction = {
    value: toks[i].text,
    range: rangeFrom(line, toks[i].start, toks[i].end)
  };
  i++;

  // Macro(ACTION) or bare ACTION.
  if (toks[i]) {
    const t = toks[i];
    const ma = RE_MACRO_ACTION.exec(t.text);
    if (ma) {
      const macroEnd = t.start + ma[1].length;
      rule.macro = { value: ma[1], range: rangeFrom(line, t.start, macroEnd) };
      const actStart = t.start + ma[1].length + 1;
      rule.action = {
        value: ma[2],
        range: rangeFrom(line, actStart, actStart + ma[2].length)
      };
      i++;
    } else if (RE_BARE_ACTION.test(t.text)) {
      rule.action = { value: t.text, range: rangeFrom(line, t.start, t.end) };
      i++;
    }
  }

  // Flags.
  for (; i < toks.length; i++) {
    const t = toks[i];
    if (t.text.startsWith('-')) {
      const flagEntry: Rule['flags'][number] = {
        flag: t.text,
        range: rangeFrom(line, t.start, t.end)
      };
      if (
        FLAGS_WITH_VALUE.has(t.text) &&
        toks[i + 1] &&
        !toks[i + 1].text.startsWith('-')
      ) {
        const v = toks[i + 1];
        flagEntry.value = v.text;
        flagEntry.valueRange = rangeFrom(line, v.start, v.end);
        scanFlagValue(v.text, v.start, line, t.text, rule);
        i++;
      }
      rule.flags.push(flagEntry);
    }
    // Stray non-flag tokens are tolerated (validator may report missing action, etc.).
  }
  return rule;
}

function newSection(
  kind: SectionKind,
  rawHeader: string,
  headerRange: Range
): Section {
  return {
    kind,
    rawHeader,
    headerRange,
    options: [],
    aliases: [],
    ipsetEntries: [],
    rules: []
  };
}

export function parse(text: string, uri = 'inmemory'): FwDocument {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  const parseDiagnostics: Diagnostic[] = [];
  const directives: FwDocument['directives'] = {};
  let current: Section | null = null;
  let sawNonComment = false;

  for (let line = 0; line < lines.length; line++) {
    const raw = lines[line];

    // Magic directive comments are only honored in the leading comment block.
    if (!sawNonComment) {
      const d = RE_DIRECTIVE.exec(raw.trim());
      if (d) {
        const key = d[1].toLowerCase();
        if (key === 'cluster') directives.cluster = d[2];
        else if (key === 'node') directives.node = d[2];
        continue;
      }
    }

    const { code } = stripComment(raw);
    if (code.trim() === '') continue; // blank or comment-only
    sawNonComment = true;

    // Section header.
    const header = /^(\s*)\[\s*(.*?)\s*\]\s*$/.exec(code);
    if (header) {
      const inner = header[2];
      const bracketStart = header[1].length;
      const headerRange = rangeFrom(line, bracketStart, code.trimEnd().length);
      const firstWord = inner.split(/\s+/)[0] ?? '';
      const upper = firstWord.toUpperCase();
      let kind: SectionKind = 'unknown';
      let name: string | undefined;
      let nameRange: Range | undefined;
      if (upper === 'OPTIONS' || upper === 'RULES' || upper === 'ALIASES') {
        kind = upper;
      } else if (upper === 'IPSET' || upper === 'GROUP') {
        kind = upper;
        name = inner.slice(firstWord.length).trim() || undefined;
        if (name) {
          const nameIdx = code.indexOf(name, bracketStart + 1);
          if (nameIdx >= 0)
            nameRange = rangeFrom(line, nameIdx, nameIdx + name.length);
        }
      }
      current = newSection(kind, inner, headerRange);
      current.name = name;
      current.nameRange = nameRange;
      sections.push(current);
      continue;
    }

    if (!current) {
      parseDiagnostics.push({
        range: rangeFrom(
          line,
          raw.length - raw.trimStart().length,
          raw.trimEnd().length
        ),
        severity: 'error',
        code: 'content-before-section',
        message: 'Content appears before any section header.'
      });
      continue;
    }

    dispatchLine(current, code, line, parseDiagnostics);
  }

  return { uri, sections, directives, parseDiagnostics };
}

function dispatchLine(
  section: Section,
  code: string,
  line: number,
  diags: Diagnostic[]
): void {
  switch (section.kind) {
    case 'OPTIONS': {
      const m = /^(\s*)([^:\s]+)\s*:\s*(.*?)\s*$/.exec(code);
      if (!m) {
        diags.push(
          simpleDiag(
            line,
            code,
            'bad-option-line',
            'Expected `key: value`.',
            'warning'
          )
        );
        return;
      }
      const keyStart = m[1].length;
      const valueStart = code.indexOf(m[3], keyStart + m[2].length);
      const entry: OptionEntry = {
        key: m[2],
        keyRange: rangeFrom(line, keyStart, keyStart + m[2].length),
        value: m[3],
        valueRange: rangeFrom(line, valueStart, valueStart + m[3].length),
        line
      };
      section.options.push(entry);
      return;
    }
    case 'ALIASES': {
      const toks = tokenize(code, 0);
      if (toks.length < 2) {
        diags.push(
          simpleDiag(
            line,
            code,
            'bad-alias-def',
            'Expected `name address`.',
            'warning'
          )
        );
        return;
      }
      const def: AliasDef = {
        name: toks[0].text,
        nameRange: rangeFrom(line, toks[0].start, toks[0].end),
        value: toks[1].text,
        valueRange: rangeFrom(line, toks[1].start, toks[1].end),
        line
      };
      section.aliases.push(def);
      return;
    }
    case 'IPSET': {
      const m = /^(\s*)(!?)\s*(\S+)/.exec(code);
      if (!m) return;
      const valStart = code.indexOf(m[3], m[1].length + m[2].length);
      const entry: IpsetEntry = {
        negated: m[2] === '!',
        value: m[3],
        valueRange: rangeFrom(line, valStart, valStart + m[3].length),
        line
      };
      section.ipsetEntries.push(entry);
      return;
    }
    case 'RULES':
    case 'GROUP': {
      section.rules.push(parseRule(code, line));
      return;
    }
    default: {
      // unknown section — accumulate as a rule-ish line so validator can still inspect it.
      section.rules.push(parseRule(code, line));
      return;
    }
  }
}

function simpleDiag(
  line: number,
  code: string,
  diagCode: string,
  message: string,
  severity: Diagnostic['severity']
): Diagnostic {
  const start = code.length - code.trimStart().length;
  return {
    range: rangeFrom(line, start, code.trimEnd().length),
    severity,
    code: diagCode,
    message
  };
}

export type { RuleRef };
