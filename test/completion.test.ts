import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from '../src/core/parser';
import { collectSymbols } from '../src/core/symbols';
import { complete } from '../src/server/completion';
import type { Position } from 'vscode-languageserver';

// Context with one local alias + ipset + group, cluster present.
function ctx() {
  const local = collectSymbols(
    parse(
      `[ALIASES]\nweb 10.0.0.5\n[IPSET admins]\n10.0.0.1\n[group mgmt]\nIN SSH(ACCEPT)\n`
    )
  );
  const empty = collectSymbols(parse(''));
  return { local, dc: empty, hasCluster: true };
}

// Build a single-line RULES document and put the cursor at end of `line`.
function labelsAt(line: string) {
  const text = `[RULES]\n${line}`;
  const pos: Position = { line: 1, character: line.length };
  return complete(text, pos, ctx()).map((i) => i.label);
}

test('line start offers directions and GROUP, not flags/actions', () => {
  const l = labelsAt('');
  assert.ok(l.includes('IN') && l.includes('GROUP'));
  assert.ok(!l.includes('ACCEPT'));
  assert.ok(!l.includes('-source'));
});

test('after direction offers macros and actions', () => {
  const l = labelsAt('IN ');
  assert.ok(l.includes('ACCEPT'));
  assert.ok(l.includes('SSH'));
  assert.ok(!l.includes('-source'), 'no flags before an action');
});

test('after action offers flags only - not another action', () => {
  const l = labelsAt('IN ACCEPT ');
  assert.ok(l.includes('-source') && l.includes('-dport'));
  assert.ok(!l.includes('ACCEPT'));
  assert.ok(!l.includes('IN'));
});

test('after -source expects an address (aliases + ipsets), not flags', () => {
  const l = labelsAt('IN ACCEPT -source ');
  assert.ok(l.includes('web'), 'local alias offered');
  assert.ok(l.includes('+admins'), 'ipset offered');
  assert.ok(!l.includes('-dest'), 'no flags where a value is required');
});

test('after a -source value, expects flags again - not another value', () => {
  const l = labelsAt('IN ACCEPT -source web ');
  assert.ok(l.includes('-dport'));
  assert.ok(!l.includes('web'), 'value already consumed');
  assert.ok(!l.includes('ACCEPT'));
});

test('after -p expects a protocol', () => {
  const l = labelsAt('IN ACCEPT -p ');
  assert.ok(l.includes('tcp') && l.includes('udp'));
  assert.ok(!l.includes('-source'));
});

test('after -dport expects free text (no suggestions)', () => {
  assert.deepEqual(labelsAt('IN ACCEPT -dport '), []);
});

test('after GROUP offers group names', () => {
  const l = labelsAt('GROUP ');
  assert.ok(l.includes('mgmt'));
  assert.ok(!l.includes('IN'));
});

test('+ prefix narrows an address slot to IP sets', () => {
  const l = labelsAt('IN ACCEPT -source +');
  assert.ok(l.every((x) => x.startsWith('+')));
  assert.ok(l.includes('+admins'));
});

test('disabled-rule marker keeps line at start', () => {
  const l = labelsAt('|');
  assert.ok(l.includes('IN') && l.includes('GROUP'));
});
