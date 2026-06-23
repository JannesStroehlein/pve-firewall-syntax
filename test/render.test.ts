import assert from "node:assert/strict";
import { test } from "node:test";
import { parse } from "../src/core/parser";
import { collectSymbols } from "../src/core/symbols";
import { renderAlias, renderGroup, renderIpset } from "../src/server/render";

test("alias hover shows value and declaration comment", () => {
  const t = collectSymbols(parse(`[ALIASES]\ntraefik 10.10.0.102 # lxc-traefik-01\n`));
  const out = renderAlias("traefik", t.aliases.get("traefik"));
  assert.match(out, /10\.10\.0\.102/);
  assert.match(out, /lxc-traefik-01/);
});

test("IP set hover lists members with their comments and header comment", () => {
  const t = collectSymbols(
    parse(`[IPSET admins] # AD domain members\n10.0.0.1 # gateway\n!192.168.0.5 # excluded\nfiler\n`),
  );
  const out = renderIpset("+admins", t.ipsets.get("admins"));
  assert.match(out, /AD domain members/); // header comment
  assert.match(out, /10\.0\.0\.1/);
  assert.match(out, /gateway/); // member comment
  assert.match(out, /!192\.168\.0\.5/); // negated member rendered
  assert.match(out, /excluded/);
  assert.match(out, /filer/); // alias member
});

test("group hover lists contained rules with comments and header comment", () => {
  const t = collectSymbols(
    parse(`[group mgmt] # management access\nIN SSH(ACCEPT) -source +management # ssh\nIN Ping(ACCEPT)\n`),
  );
  const out = renderGroup("mgmt", t.groups.get("mgmt"));
  assert.match(out, /management access/); // header comment
  assert.match(out, /IN SSH\(ACCEPT\) -source \+management/);
  assert.match(out, /ssh/); // rule comment
  assert.match(out, /IN Ping\(ACCEPT\)/);
});

test("unresolved symbols render a clear message", () => {
  assert.match(renderAlias("ghost", undefined), /unresolved alias/);
  assert.match(renderIpset("+ghost", undefined), /unresolved IP set/);
  assert.match(renderGroup("ghost", undefined), /unresolved security group/);
});
