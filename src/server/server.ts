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
  MACRO_INFO,
  ResolutionContext,
  Resolver,
  parse,
  validate,
} from "../core/index";
import { complete } from "./completion";
import { renderMacro } from "./render";

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

function validateDocument(doc: TextDocument): void {
  const fsPath = uriToPath(doc.uri);
  const parsed = parse(doc.getText(), fsPath ?? doc.uri);
  const ctx = resolver.build(fsPath, parsed, {
    clusterPath: settings.clusterPath,
    node: settings.node,
  });
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
  connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

connection.onCompletion((params): CompletionItem[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];
  const fsPath = uriToPath(doc.uri);
  const parsed = parse(doc.getText(), fsPath ?? doc.uri);
  const ctx = resolver.build(fsPath, parsed, {
    clusterPath: settings.clusterPath,
    node: settings.node,
  });
  return complete(doc.getText(), params.position, ctx);
});

function inRange(r: Range, pos: Position): boolean {
  if (pos.line !== r.start.line) return false;
  return pos.character >= r.start.character && pos.character <= r.end.character;
}

connection.onHover((params: HoverParams): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;
  const fsPath = uriToPath(doc.uri);
  const parsed = parse(doc.getText(), fsPath ?? doc.uri);
  const ctx = resolver.build(fsPath, parsed, {
    clusterPath: settings.clusterPath,
    node: settings.node,
  });
  const pos = params.position;

  for (const section of parsed.sections) {
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
  const found = ctx.local.groups.get(name) ?? ctx.dc.groups.get(name);
  return found
    ? `**group ${name}** — security group
    ${found.range}
    `
    : `**${name}** — unresolved security group`;
}

function describeRef(
  ref: { kind: "alias" | "ipset"; dc: boolean; name: string },
  ctx: ResolutionContext,
): string {
  // Bare refs resolve local then datacenter; dc/ refs only the datacenter.
  if (ref.kind === "alias") {
    const a = ref.dc
      ? ctx.dc.aliases.get(ref.name)
      : (ctx.local.aliases.get(ref.name) ?? ctx.dc.aliases.get(ref.name));
    const label = ref.dc ? `dc/${ref.name}` : ref.name;
    return a
      ? `**${label}** — alias → \`${a.value ?? ""}\``
      : `**${label}** — unresolved alias`;
  }
  const s = ref.dc
    ? ctx.dc.ipsets.get(ref.name)
    : (ctx.local.ipsets.get(ref.name) ?? ctx.dc.ipsets.get(ref.name));
  const label = ref.dc ? `+dc/${ref.name}` : `+${ref.name}`;
  return s ? `**${label}** — IP set` : `**${label}** — unresolved IP set`;
}

documents.listen(connection);
connection.listen();
