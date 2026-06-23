// Collect symbol definitions (aliases, IP sets, security groups) from a parsed document.

import { FwDocument, Range } from './model';

export interface SymbolDef {
  name: string;
  /** Definition location (header or def line) within its source document. */
  range: Range;
  /** For aliases: the address value, surfaced in hovers/completion detail. */
  value?: string;
  /** Trailing `# comment` on the declaration line. */
  comment?: string;
  /** For IP sets: member entries (IPs, ranges, alias names), each with its own comment. */
  members?: { value: string; negated: boolean; comment?: string }[];
  /** For security groups: the raw rule lines contained in the group, with comments. */
  groupRules?: { raw: string; comment?: string }[];
}

export interface SymbolTable {
  aliases: Map<string, SymbolDef>;
  ipsets: Map<string, SymbolDef>;
  groups: Map<string, SymbolDef>;
  /** Duplicate definitions, for diagnostics. */
  duplicates: {
    kind: 'alias' | 'ipset' | 'group';
    name: string;
    range: Range;
  }[];
}

export function collectSymbols(doc: FwDocument): SymbolTable {
  const table: SymbolTable = {
    aliases: new Map(),
    ipsets: new Map(),
    groups: new Map(),
    duplicates: []
  };

  const add = (
    map: Map<string, SymbolDef>,
    kind: 'alias' | 'ipset' | 'group',
    def: SymbolDef
  ) => {
    if (map.has(def.name)) {
      table.duplicates.push({ kind, name: def.name, range: def.range });
    } else {
      map.set(def.name, def);
    }
  };

  for (const section of doc.sections) {
    if (section.kind === 'ALIASES') {
      for (const a of section.aliases)
        add(table.aliases, 'alias', {
          name: a.name,
          range: a.nameRange,
          value: a.value,
          comment: a.comment
        });
    } else if (section.kind === 'IPSET' && section.name) {
      add(table.ipsets, 'ipset', {
        name: section.name,
        range: section.nameRange ?? section.headerRange,
        comment: section.comment,
        members: section.ipsetEntries.map((e) => ({
          value: e.value,
          negated: e.negated,
          comment: e.comment
        }))
      });
    } else if (section.kind === 'GROUP' && section.name) {
      add(table.groups, 'group', {
        name: section.name,
        range: section.nameRange ?? section.headerRange,
        comment: section.comment,
        groupRules: section.rules.map((r) => ({
          raw: r.raw ?? '',
          comment: r.comment
        }))
      });
    }
  }
  return table;
}

/** Merge a datacenter table into a view used for resolution. Local wins for same name. */
export interface ResolutionContext {
  local: SymbolTable;
  /** Datacenter-scoped symbols from cluster.fw (may be empty). */
  dc: SymbolTable;
  /** True when a cluster.fw was located and parsed. */
  hasCluster: boolean;
}

export type RefKind = 'alias' | 'ipset' | 'group';

export type RefScope =
  | 'local' // resolved in the file itself
  | 'dc' // resolved at the datacenter (cluster.fw) level
  | 'unresolved' // definitely not defined anywhere we can see
  | 'unknown'; // cluster.fw unavailable, so it might be a dc symbol we can't check

/** A reference resolved against a context - carries the actual declaration. */
export interface ResolvedRef {
  kind: RefKind;
  /** Display label including scope prefix, e.g. `+dc/admins`, `dc/local_net`. */
  label: string;
  /** The declaration this reference points at, when found (with members/rules/value). */
  def?: SymbolDef;
  scope: RefScope;
}

function tableFor(t: SymbolTable, kind: RefKind): Map<string, SymbolDef> {
  return kind === 'alias' ? t.aliases : kind === 'ipset' ? t.ipsets : t.groups;
}

function labelFor(kind: RefKind, name: string, dc: boolean): string {
  if (kind === 'ipset') return dc ? `+dc/${name}` : `+${name}`;
  if (kind === 'alias') return dc ? `dc/${name}` : name;
  return name; // groups are referenced bare
}

/**
 * Resolve a symbol reference. Bare references resolve locally first, then fall
 * back to the datacenter (cluster.fw) - exactly how PVE resolves guest rules.
 * `dc/`-scoped references only consider the datacenter. This is the single place
 * that knows the resolution rules; validation and hovers both call it.
 */
export function resolveSymbol(
  kind: RefKind,
  name: string,
  dc: boolean,
  ctx: ResolutionContext
): ResolvedRef {
  const label = labelFor(kind, name, dc);
  const local = tableFor(ctx.local, kind);
  const dcTable = tableFor(ctx.dc, kind);

  if (dc) {
    if (!ctx.hasCluster) return { kind, label, scope: 'unknown' };
    const def = dcTable.get(name);
    return { kind, label, def, scope: def ? 'dc' : 'unresolved' };
  }

  const localDef = local.get(name);
  if (localDef) return { kind, label, def: localDef, scope: 'local' };
  const dcDef = dcTable.get(name);
  if (dcDef) return { kind, label, def: dcDef, scope: 'dc' };
  if (!ctx.hasCluster) return { kind, label, scope: 'unknown' };
  return { kind, label, scope: 'unresolved' };
}
