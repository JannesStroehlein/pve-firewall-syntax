import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MACROS, MACRO_INFO } from '../src/core/index';

test('macros generated from upstream macros.json', () => {
  assert.ok(MACROS.length >= 88, `expected >=88 macros, got ${MACROS.length}`);
  assert.equal(MACROS.length, Object.keys(MACRO_INFO).length);
});

test('macro info carries description and port/proto data', () => {
  const ssh = MACRO_INFO['SSH'];
  assert.ok(ssh);
  assert.match(ssh.desc, /shell/i);
  assert.deepEqual(ssh.code, [{ proto: 'tcp', dport: '22' }]);

  const ceph = MACRO_INFO['Ceph'];
  assert.ok(ceph.code.length > 1);
});

test('proto-only macros (no port) are preserved', () => {
  assert.deepEqual(MACRO_INFO['OSPF'].code, [{ proto: '89' }]);
});
