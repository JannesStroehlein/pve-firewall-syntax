// VS Code extension entry point: launches the bundled language server.

import * as path from 'node:path';
import { ExtensionContext, workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] }
    }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'pve-firewall' }],
    synchronize: {
      // Re-validate when cluster.fw files change on disk.
      fileEvents: workspace.createFileSystemWatcher('**/cluster.fw')
    }
  };

  client = new LanguageClient(
    'pveFirewall',
    'PVE Firewall Language Server',
    serverOptions,
    clientOptions
  );
  void client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
