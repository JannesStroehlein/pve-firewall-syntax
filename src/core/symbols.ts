// Collect symbol definitions (aliases, IP sets, security groups) from a parsed document.

import { FwDocument, Range } from "./model";

export interface SymbolDef {
  name: string;
  /** Definition location (header or def line) within its source document. */
  range: Range;
  /** For aliases: the address value, surfaced in hovers/completion detail. */
  value?: string;
}

export interface SymbolTable {
  aliases: Map<string, SymbolDef>;
  ipsets: Map<string, SymbolDef>;
  groups: Map<string, SymbolDef>;
  /** Duplicate definitions, for diagnostics. */
  duplicates: {
    kind: "alias" | "ipset" | "group";
    name: string;
    range: Range;
  }[];
}

export function collectSymbols(doc: FwDocument): SymbolTable {
  const table: SymbolTable = {
    aliases: new Map(),
    ipsets: new Map(),
    groups: new Map(),
    duplicates: [],
  };

  const add = (
    map: Map<string, SymbolDef>,
    kind: "alias" | "ipset" | "group",
    name: string,
    range: Range,
    value?: string,
  ) => {
    if (map.has(name)) {
      table.duplicates.push({ kind, name, range });
    } else {
      map.set(name, { name, range, value });
    }
  };

  for (const section of doc.sections) {
    if (section.kind === "ALIASES") {
      for (const a of section.aliases)
        add(table.aliases, "alias", a.name, a.nameRange, a.value);
    } else if (section.kind === "IPSET" && section.name) {
      add(
        table.ipsets,
        "ipset",
        section.name,
        section.nameRange ?? section.headerRange,
      );
    } else if (section.kind === "GROUP" && section.name) {
      add(
        table.groups,
        "group",
        section.name,
        section.nameRange ?? section.headerRange,
      );
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
