import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "../src/core/parser";
import { collectSymbols } from "../src/core/symbols";
import { validate } from "../src/core/validate";

// Build a resolution context. hasCluster defaults to true (with an empty
// datacenter table) so bare references that resolve nowhere are reported;
// pass hasCluster=false to model "no cluster.fw available".
function codes(text: string, hasCluster = true): string[] {
  const doc = parse(text);
  const empty = collectSymbols(parse(""));
  const ctx = { local: collectSymbols(doc), dc: empty, hasCluster };
  return validate(doc, ctx, { warnMissingCluster: false }).map((d) => d.code);
}

test("clean file yields no diagnostics", () => {
  const text = `[OPTIONS]\nenable: 1\npolicy_in: DROP\n\n[ALIASES]\nnet 10.0.0.0/24\n\n[RULES]\nIN ACCEPT -p tcp -dport 22 -source net\n`;
  assert.deepEqual(codes(text), []);
});

test("flags bad option values", () => {
  const c = codes(`[OPTIONS]\nenable: 2\npolicy_in: NOPE\nbogus_key: 1\n`);
  assert.ok(c.includes("bad-option-value"));
  assert.ok(c.includes("unknown-option"));
});

test("flags malformed ip and port", () => {
  const c = codes(`[RULES]\nIN ACCEPT -source 1.2.3.999 -p tcp -dport 70000\n`);
  assert.ok(c.includes("bad-ip"));
  assert.ok(c.includes("bad-port"));
});

test("flags unknown macro, direction and missing action", () => {
  assert.ok(codes(`[RULES]\nIN BOGUS(ACCEPT)\n`).includes("unknown-macro"));
  assert.ok(codes(`[RULES]\nSIDEWAYS ACCEPT\n`).includes("unknown-direction"));
  assert.ok(codes(`[RULES]\nIN -p tcp -dport 22\n`).includes("missing-action"));
});

test("flags unknown rule flag", () => {
  assert.ok(codes(`[RULES]\nIN ACCEPT -bogus foo\n`).includes("unknown-flag"));
});

test("unresolved local alias and ipset", () => {
  const c = codes(
    `[RULES]\nIN ACCEPT -source missing -p tcp -dport 22\nIN ACCEPT -source +nope\n`,
  );
  assert.ok(c.includes("unresolved-alias"));
  assert.ok(c.includes("unresolved-ipset"));
});

test("local alias defined in same file resolves", () => {
  const c = codes(
    `[ALIASES]\nweb 10.0.0.5\n[RULES]\nIN ACCEPT -source web -p tcp -dport 80\n`,
  );
  assert.deepEqual(c, []);
});

test("duplicate alias detected", () => {
  const c = codes(`[ALIASES]\nweb 10.0.0.5\nweb 10.0.0.6\n`);
  assert.ok(c.includes("duplicate-alias"));
});

test("unknown section header", () => {
  assert.ok(codes(`[BOGUS]\n`).includes("unknown-section"));
});

test("IP set members may be alias references", () => {
  // Bare alias defined locally resolves; literal IP is fine; junk is flagged.
  const text = `[ALIASES]\nfiler 10.0.0.9\n[IPSET ad_domain]\nfiler\n10.0.0.1\n`;
  assert.deepEqual(codes(text), []);
});

test("undefined alias in an IP set is reported", () => {
  const c = codes(`[IPSET ad_domain]\nsv_lxc-filer-01\n`);
  assert.ok(c.includes("unresolved-alias"));
  assert.ok(!c.includes("bad-ip"));
});

test("garbage IP set member is still flagged as bad-ip", () => {
  const c = codes(`[IPSET x]\n999.1.1.1\n`);
  assert.ok(c.includes("bad-ip"));
});

test("dc/ reference without cluster does not hard-error", () => {
  const c = codes(
    `[RULES]\nIN ACCEPT -source dc/whatever -p tcp -dport 22\n`,
    false,
  );
  assert.ok(!c.includes("unresolved-alias"));
});

test("bare reference without cluster is not flagged (could be a dc symbol)", () => {
  const c = codes(
    `[RULES]\nIN ACCEPT -source maybe_dc_alias -p tcp -dport 22\n`,
    false,
  );
  assert.ok(!c.includes("unresolved-alias"));
});

test("bare alias resolves from datacenter scope when cluster is present", () => {
  // local has no aliases; dc provides it -> should resolve.
  const doc = parse(`[RULES]\nIN ACCEPT -source traefik -p tcp -dport 80\n`);
  const dc = collectSymbols(parse(`[ALIASES]\ntraefik 10.10.0.102\n`));
  const ctx = { local: collectSymbols(doc), dc, hasCluster: true };
  const c = validate(doc, ctx).map((d) => d.code);
  assert.deepEqual(c, []);
});
