import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from '../src/core/parser';

test('parses sections and option entries with ranges', () => {
  const doc = parse(`[OPTIONS]\nenable: 1\npolicy_in: DROP\n`);
  assert.equal(doc.sections.length, 1);
  const s = doc.sections[0];
  assert.equal(s.kind, 'OPTIONS');
  assert.equal(s.options.length, 2);
  assert.equal(s.options[0].key, 'enable');
  assert.equal(s.options[0].value, '1');
  // value "1" sits at column 8 on line 1
  assert.deepEqual(s.options[0].valueRange.start, { line: 1, character: 8 });
});

test('parses IPSET and group section names', () => {
  const doc = parse(
    `[IPSET management]\n10.0.0.0/24\n[group webserver]\nIN HTTP(ACCEPT)\n`
  );
  assert.equal(doc.sections[0].kind, 'IPSET');
  assert.equal(doc.sections[0].name, 'management');
  assert.equal(doc.sections[0].ipsetEntries[0].value, '10.0.0.0/24');
  assert.equal(doc.sections[1].kind, 'GROUP');
  assert.equal(doc.sections[1].name, 'webserver');
});

test('parses a macro rule and captures macro + action ranges', () => {
  const doc = parse(`[RULES]\nIN SSH(ACCEPT) -source +management\n`);
  const rule = doc.sections[0].rules[0];
  assert.equal(rule.direction?.value, 'IN');
  assert.equal(rule.macro?.value, 'SSH');
  assert.equal(rule.action?.value, 'ACCEPT');
  // +management ipset ref captured
  const ref = rule.refs.find((r) => r.kind === 'ipset');
  assert.ok(ref);
  assert.equal(ref.name, 'management');
  assert.equal(ref.dc, false);
});

test('captures dc/ alias and +dc/ ipset references', () => {
  const doc = parse(
    `[RULES]\nIN ACCEPT -source dc/local,+dc/admins -p tcp -dport 22\n`
  );
  const rule = doc.sections[0].rules[0];
  const alias = rule.refs.find((r) => r.kind === 'alias');
  const ipset = rule.refs.find((r) => r.kind === 'ipset');
  assert.equal(alias?.dc, true);
  assert.equal(alias?.name, 'local');
  assert.equal(ipset?.dc, true);
  assert.equal(ipset?.name, 'admins');
});

test('disabled rule marked from leading pipe', () => {
  const doc = parse(`[RULES]\n|IN ACCEPT -p tcp -dport 3128\n`);
  assert.equal(doc.sections[0].rules[0].disabled, true);
  assert.equal(doc.sections[0].rules[0].direction?.value, 'IN');
});

test('magic directives parsed from header comments', () => {
  const doc = parse(
    `# pve-fw: cluster=../cluster.fw\n# pve-fw: node=pve1\n[RULES]\n`
  );
  assert.equal(doc.directives.cluster, '../cluster.fw');
  assert.equal(doc.directives.node, 'pve1');
});

test('ignores inline comments in code', () => {
  const doc = parse(`[RULES]\nIN ACCEPT -p tcp -dport 22 # ssh\n`);
  const rule = doc.sections[0].rules[0];
  assert.equal(rule.action?.value, 'ACCEPT');
  assert.equal(rule.literals.find((l) => l.context === 'port')?.text, '22');
});
