import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "../src/core/parser";
import { FileSystem, Resolver } from "../src/core/resolver";
import { validate } from "../src/core/validate";

const CLUSTER = `[ALIASES]\nlocal_network 192.168.1.0/24\n[IPSET management]\n10.0.0.0/24\n[group webserver]\nIN HTTP(ACCEPT)\n`;

/** In-memory filesystem for deterministic resolver tests. */
function memFs(files: Record<string, string>): FileSystem {
  return {
    readFile: (p) => files[p],
    mtimeMs: (p) => (p in files ? 1 : undefined),
  };
}

test("resolves dc/ alias, +dc/ ipset and GROUP from cluster.fw via directive", () => {
  const fs = memFs({ "/etc/pve/firewall/cluster.fw": CLUSTER });
  const resolver = new Resolver(fs);
  const guest = `# pve-fw: cluster=./cluster.fw\n[RULES]\nGROUP webserver\nIN ACCEPT -source dc/local_network -p tcp -dport 80\nIN ACCEPT -source +dc/management -p tcp -dport 22\n`;
  const doc = parse(guest, "/etc/pve/firewall/100.fw");
  const ctx = resolver.build("/etc/pve/firewall/100.fw", doc, {});
  assert.equal(ctx.hasCluster, true);
  const diags = validate(doc, ctx);
  assert.deepEqual(
    diags.map((d) => d.code),
    [],
  );
});

test("flags dc/ references missing from cluster.fw", () => {
  const fs = memFs({ "/etc/pve/firewall/cluster.fw": CLUSTER });
  const resolver = new Resolver(fs);
  const guest = `# pve-fw: cluster=./cluster.fw\n[RULES]\nIN ACCEPT -source dc/nope -p tcp -dport 80\nGROUP ghost\n`;
  const doc = parse(guest, "/etc/pve/firewall/100.fw");
  const ctx = resolver.build("/etc/pve/firewall/100.fw", doc, {});
  const codes = validate(doc, ctx).map((d) => d.code);
  assert.ok(codes.includes("unresolved-alias"));
  assert.ok(codes.includes("unresolved-group"));
});

test("auto-discovers sibling cluster.fw without a directive", () => {
  const fs = memFs({
    "/etc/pve/firewall/cluster.fw": CLUSTER,
    "/etc/pve/firewall/100.fw": "",
  });
  const resolver = new Resolver(fs);
  const doc = parse(`[RULES]\nGROUP webserver\n`, "/etc/pve/firewall/100.fw");
  const ctx = resolver.build("/etc/pve/firewall/100.fw", doc, {});
  assert.equal(ctx.hasCluster, true);
  assert.deepEqual(
    validate(doc, ctx).map((d) => d.code),
    [],
  );
});

test("cluster.fw self-resolves its own dc/ references", () => {
  const resolver = new Resolver(memFs({}));
  const doc = parse(
    CLUSTER + `[RULES]\nIN ACCEPT -source dc/local_network -p tcp -dport 80\n`,
    "/etc/pve/firewall/cluster.fw",
  );
  const ctx = resolver.build("/etc/pve/firewall/cluster.fw", doc, {});
  assert.equal(ctx.hasCluster, true);
  assert.deepEqual(
    validate(doc, ctx).map((d) => d.code),
    [],
  );
});

test("no cluster found -> hasCluster false and missing-cluster hint", () => {
  const resolver = new Resolver(memFs({}));
  const doc = parse(
    `[RULES]\nIN ACCEPT -source dc/x -p tcp -dport 80\n`,
    "/tmp/standalone.fw",
  );
  const ctx = resolver.build("/tmp/standalone.fw", doc, {});
  assert.equal(ctx.hasCluster, false);
  assert.ok(
    validate(doc, ctx, { warnMissingCluster: true }).some(
      (d) => d.code === "no-cluster",
    ),
  );
});
