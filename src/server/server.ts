// PVE firewall language server: diagnostics + completion over the shared core engine.

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  CompletionItem,
  Diagnostic as LspDiagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  Hover,
  HoverParams,
  InitializeParams,
  MarkupKind,
  Position,
  ProposedFeatures,
  Range,
  TextDocumentSyncKind,
  TextDocuments,
  createConnection,
} from "vscode-languageserver/node";
import { fileURLToPath } from "node:url";
import {
  Diagnostic as CoreDiagnostic,
  FwDocument,
  MACRO_INFO,
  ResolutionContext,
  Resolver,
  parse,
  resolveSymbol,
  validate,
} from "../core/index";
import { complete } from "./completion";
import { renderAlias, renderGroup, renderIpset, renderMacro } from "./render";

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const resolver = new Resolver();

interface Settings {
  clusterPath?: string;
  node?: string;
  warnMissingCluster: boolean;
}
const DEFAULT_SETTINGS: Settings = { warnMissingCluster: true };
let settings: Settings = DEFAULT_SETTINGS;
let hasConfigurationCapability = false;

function uriToPath(uri: string): string | undefined {
  if (!uri.startsWith("file:")) return undefined;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
}

const SEVERITY: Record<CoreDiagnostic["severity"], DiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
  hint: DiagnosticSeverity.Hint,
};

function toLsp(d: CoreDiagnostic): LspDiagnostic {
  return {
    range: d.range,
    severity: SEVERITY[d.severity],
    code: d.code,
    source: "pve-firewall",
    message: d.message,
  };
}

// Parse cache keyed by document version. A change re-parses (via validateDocument);
// hover/completion on the same version reuse that parse instead of redoing it.
const analyses = new Map<string, { version: number; doc: FwDocument }>();

function analyze(doc: TextDocument): FwDocument {
  const cached = analyses.get(doc.uri);
  if (cached && cached.version === doc.version) return cached.doc;
  const fsPath = uriToPath(doc.uri);
  const parsed = parse(doc.getText(), fsPath ?? doc.uri);
  analyses.set(doc.uri, { version: doc.version, doc: parsed });
  return parsed;
}

function contextFor(doc: TextDocument, parsed: FwDocument): ResolutionContext {
  return resolver.build(uriToPath(doc.uri), parsed, {
    clusterPath: settings.clusterPath,
    node: settings.node,
  });
}

function validateDocument(doc: TextDocument): void {
  const parsed = analyze(doc);
  const ctx = contextFor(doc, parsed);
  const diagnostics = validate(parsed, ctx, {
    warnMissingCluster: settings.warnMissingCluster,
  }).map(toLsp);
  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

function validateAll(): void {
  for (const doc of documents.all()) validateDocument(doc);
}

connection.onInitialize((params: InitializeParams) => {
  hasConfigurationCapability = !!params.capabilities.workspace?.configuration;
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ["[", "-", "+", " ", "/"],
      },
      hoverProvider: true,
    },
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined,
    );
    void refreshSettings();
  }
});

async function refreshSettings(): Promise<void> {
  if (!hasConfigurationCapability) return;
  try {
    const cfg = await connection.workspace.getConfiguration("pveFirewall");
    settings = {
      clusterPath: cfg?.clusterPath || undefined,
      node: cfg?.node || undefined,
      warnMissingCluster: cfg?.warnMissingCluster ?? true,
    };
  } catch {
    settings = DEFAULT_SETTINGS;
  }
}

connection.onDidChangeConfiguration(async () => {
  await refreshSettings();
  validateAll();
});

// Re-validate dependents when a cluster.fw saved on disk changes.
connection.onDidChangeWatchedFiles((params) => {
  for (const change of params.changes) {
    const p = uriToPath(change.uri);
    if (p) resolver.invalidate(p);
  }
  validateAll();
});

documents.onDidChangeContent((e) => {
  const p = uriToPath(e.document.uri);
  if (p) resolver.invalidate(p); // a guest editing cluster.fw should refresh others
  validateDocument(e.document);
  // If the changed doc is a cluster.fw, dependents may need re-checking.
  if (p && /cluster\.fw$/i.test(p)) validateAll();
});

documents.onDidClose((e) => {
  analyses.delete(e.document.uri);
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// Characters that belong to a completion token. Includes `-`/`+`/`/` so that
// flag (`-source`), IP set (`+management`) and scoped tokens are fully replaced
// rather than appended after the prefix the user already typed.
const TOKEN_CHAR = /[A-Za-z0-9_+/.-]/;

connection.onCompletion((params): CompletionItem[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const ctx = contextFor(doc, analyze(doc));
  const items = complete(doc.getText(), params.position, ctx);

  // Replace the whole token under the cursor, so a typed `-`/`+` prefix is not
  // duplicated (e.g. `-so` + `-source` would otherwise insert `--source`).
  const pos = params.position;
  const line = doc.getText().split(/\r?\n/)[pos.line] ?? "";
  let start = pos.character;
  while (start > 0 && TOKEN_CHAR.test(line[start - 1])) start--;
  const range: Range = { start: { line: pos.line, character: start }, end: pos };
  for (const it of items) {
    const newText = it.insertText ?? it.label;
    it.textEdit = { range, newText };
  }
  return items;
});

function inRange(r: Range, pos: Position): boolean {
  if (pos.line !== r.start.line) return false;
  return pos.character >= r.start.character && pos.character <= r.end.character;
}

connection.onHover((params: HoverParams): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const parsed = analyze(doc);
  const ctx = contextFor(doc, parsed);
  const pos = params.position;

  for (const section of parsed.sections) {
    // Definition sites: alias name, IPSET/group header name.
    if (section.kind === "ALIASES") {
      for (const a of section.aliases) {
        if (inRange(a.nameRange, pos)) {
          return md(renderAlias(a.name, ctx.local.aliases.get(a.name)), a.nameRange);
        }
      }
    }
    if (section.kind === "IPSET" && section.name && section.nameRange && inRange(section.nameRange, pos)) {
      return md(renderIpset(`+${section.name}`, ctx.local.ipsets.get(section.name)), section.nameRange);
    }
    if (section.kind === "GROUP" && section.name && section.nameRange && inRange(section.nameRange, pos)) {
      return md(describeGroup(section.name, ctx), section.nameRange);
    }

    for (const rule of section.rules) {
      if (rule.macro && inRange(rule.macro.range, pos)) {
        const info = MACRO_INFO[rule.macro.value];
        if (info) return md(renderMacro(info), rule.macro.range);
      }
      if (rule.groupRef && inRange(rule.groupRef.range, pos)) {
        return md(describeGroup(rule.groupRef.name, ctx), rule.groupRef.range);
      }
      for (const ref of rule.refs) {
        if (inRange(ref.range, pos))
          return md(describeRef(ref, ctx), ref.range);
      }
    }
  }
  return null;
});

function md(value: string, range: Range): Hover {
  return { contents: { kind: MarkupKind.Markdown, value }, range };
}

function describeGroup(name: string, ctx: ResolutionContext): string {
  const r = resolveSymbol("group", name, false, ctx);
  return renderGroup(name, r.def);
}

function describeRef(
  ref: { kind: "alias" | "ipset"; dc: boolean; name: string },
  ctx: ResolutionContext,
): string {
  const r = resolveSymbol(ref.kind, ref.name, ref.dc, ctx);
  return ref.kind === "alias" ? renderAlias(r.label, r.def) : renderIpset(r.label, r.def);
}

documents.listen(connection);
connection.listen();
