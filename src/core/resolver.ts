// Cross-file resolution: locate and parse cluster.fw to resolve dc/ symbols.
// Filesystem access is injected so the core stays testable.

import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { FwDocument } from './model';
import { parse } from './parser';
import { ResolutionContext, SymbolTable, collectSymbols } from './symbols';

export interface FileSystem {
  readFile(p: string): string | undefined;
  mtimeMs(p: string): number | undefined;
}

export const nodeFs: FileSystem = {
  readFile(p) {
    try {
      return fsSync.readFileSync(p, 'utf8');
    } catch {
      return undefined;
    }
  },
  mtimeMs(p) {
    try {
      return fsSync.statSync(p).mtimeMs;
    } catch {
      return undefined;
    }
  }
};

export interface ResolveOptions {
  /** Explicit cluster.fw path (absolute or relative to the target file's directory). */
  clusterPath?: string;
  /** Default node name when the file has no `# pve-fw: node=` directive. */
  node?: string;
}

interface CacheEntry {
  mtimeMs: number;
  symbols: SymbolTable;
}

/** Caches parsed cluster.fw symbol tables by path + mtime. Hold one per session. */
export class Resolver {
  private cache = new Map<string, CacheEntry>();
  constructor(private fs: FileSystem = nodeFs) {}

  /** Drop a cached entry (e.g. when the file changes on disk or in the editor). */
  invalidate(p: string): void {
    this.cache.delete(path.resolve(p));
  }

  build(
    targetPath: string | undefined,
    doc: FwDocument,
    options: ResolveOptions = {}
  ): ResolutionContext {
    const local = collectSymbols(doc);

    // The cluster file is its own datacenter: self-resolve dc/ references.
    if (
      targetPath &&
      path.basename(targetPath).toLowerCase() === 'cluster.fw'
    ) {
      return { local, dc: local, hasCluster: true };
    }

    const clusterPath = this.discoverCluster(targetPath, doc, options);
    if (!clusterPath) {
      return { local, dc: collectSymbols(parse('')), hasCluster: false };
    }
    const dc = this.symbolsFor(clusterPath);
    if (!dc) {
      return { local, dc: collectSymbols(parse('')), hasCluster: false };
    }
    return { local, dc, hasCluster: true };
  }

  /** Resolve the cluster.fw path. Returns undefined if none can be found. */
  discoverCluster(
    targetPath: string | undefined,
    doc: FwDocument,
    options: ResolveOptions
  ): string | undefined {
    const baseDir = targetPath
      ? path.dirname(path.resolve(targetPath))
      : process.cwd();

    if (doc.directives.cluster) {
      const p = path.isAbsolute(doc.directives.cluster)
        ? doc.directives.cluster
        : path.resolve(baseDir, doc.directives.cluster);
      if (this.fs.mtimeMs(p) !== undefined) return p;
    }
    if (options.clusterPath) {
      const p = path.isAbsolute(options.clusterPath)
        ? options.clusterPath
        : path.resolve(baseDir, options.clusterPath);
      if (this.fs.mtimeMs(p) !== undefined) return p;
    }

    // Walk up looking for cluster.fw (sibling) or firewall/cluster.fw (mirrored /etc/pve layout).
    let dir = baseDir;
    for (let depth = 0; depth < 16; depth++) {
      for (const candidate of [
        path.join(dir, 'cluster.fw'),
        path.join(dir, 'firewall', 'cluster.fw')
      ]) {
        if (
          this.fs.mtimeMs(candidate) !== undefined &&
          path.resolve(candidate) !== targetPath
        ) {
          return candidate;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return undefined;
  }

  private symbolsFor(p: string): SymbolTable | undefined {
    const resolved = path.resolve(p);
    const mtime = this.fs.mtimeMs(resolved);
    if (mtime === undefined) return undefined;
    const cached = this.cache.get(resolved);
    if (cached && cached.mtimeMs === mtime) return cached.symbols;
    const text = this.fs.readFile(resolved);
    if (text === undefined) return undefined;
    const symbols = collectSymbols(parse(text, resolved));
    this.cache.set(resolved, { mtimeMs: mtime, symbols });
    return symbols;
  }
}
