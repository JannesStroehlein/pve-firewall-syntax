// Core data model for a parsed PVE firewall (.fw) document.
// Pure types + lightweight helpers. No vscode imports - shared by CLI and server.

/** Zero-based line/character position (LSP-compatible). */
export interface Position {
  line: number;
  character: number;
}

/** Zero-based half-open range. */
export interface Range {
  start: Position;
  end: Position;
}

/** A port/protocol entry expanded by a built-in macro (from upstream macros.json). */
export interface MacroPort {
  proto?: string;
  dport?: string;
  sport?: string;
  'icmp-type'?: string;
}

/** A built-in firewall macro and the traffic it allows. */
export interface MacroInfo {
  name: string;
  desc: string;
  code: MacroPort[];
}

export type Severity = 'error' | 'warning' | 'info' | 'hint';

export interface Diagnostic {
  range: Range;
  severity: Severity;
  /** Stable machine code, e.g. "unresolved-alias". */
  code: string;
  message: string;
}

export type SectionKind =
  | 'OPTIONS'
  | 'RULES'
  | 'ALIASES'
  | 'IPSET'
  | 'GROUP'
  | 'unknown';

/** A `key: value` line inside [OPTIONS]. */
export interface OptionEntry {
  key: string;
  keyRange: Range;
  value: string;
  valueRange: Range;
  line: number;
}

/** An alias definition inside [ALIASES]: `name cidr`. */
export interface AliasDef {
  name: string;
  nameRange: Range;
  value: string;
  valueRange: Range;
  line: number;
  /** Trailing `# comment` on the definition line, if any. */
  comment?: string;
}

/** An entry inside [IPSET name]: `[!]ip[/cidr]`. */
export interface IpsetEntry {
  negated: boolean;
  value: string;
  valueRange: Range;
  line: number;
  /** Trailing `# comment` on the entry line, if any. */
  comment?: string;
}

/** A token reference inside a rule (alias, ipset, ip, port) with its range. */
export interface RuleRef {
  /** "alias" -> bare alias or dc/alias; "ipset" -> +name or +dc/name. */
  kind: 'alias' | 'ipset';
  /** Datacenter scope, i.e. the `dc/` prefix was present. */
  dc: boolean;
  /** Bare name without scope prefix or `+`. */
  name: string;
  range: Range;
}

/** A parsed firewall rule (inside [RULES] or [group name]). */
export interface Rule {
  line: number;
  disabled: boolean;
  /** Present for `GROUP name` rule lines. */
  groupRef?: { name: string; range: Range };
  direction?: { value: string; range: Range };
  macro?: { value: string; range: Range };
  action?: { value: string; range: Range };
  /** -flag tokens found. */
  flags: { flag: string; range: Range; value?: string; valueRange?: Range }[];
  /** alias/ipset references collected from option values. */
  refs: RuleRef[];
  /** IPv4 / CIDR / range / port literals for syntax validation. */
  literals: { text: string; range: Range; context: 'ip' | 'port' }[];
  /** Trimmed code text of the rule line (no inline comment), for hovers. */
  raw?: string;
  /** Trailing `# comment` on the rule line, if any. */
  comment?: string;
}

export interface Section {
  kind: SectionKind;
  /** Raw header text inside the brackets, e.g. "IPSET management". */
  rawHeader: string;
  /** For IPSET / GROUP: the trailing name. */
  name?: string;
  nameRange?: Range;
  headerRange: Range;
  /** Trailing `# comment` on the section header line, if any. */
  comment?: string;
  options: OptionEntry[];
  aliases: AliasDef[];
  ipsetEntries: IpsetEntry[];
  rules: Rule[];
}

export interface FwDocument {
  uri: string;
  sections: Section[];
  /** Magic doc-comment directives parsed from the file head. */
  directives: { cluster?: string; node?: string };
  /** Structural diagnostics produced during parsing (e.g. content before any section). */
  parseDiagnostics: Diagnostic[];
}

export function rangeFrom(
  line: number,
  startCol: number,
  endCol: number
): Range {
  return {
    start: { line, character: startCol },
    end: { line, character: endCol }
  };
}
