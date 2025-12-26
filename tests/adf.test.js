import test from 'node:test';
import assert from 'node:assert/strict';

import { assertValidAdfDoc, looksLikeAdfDoc } from '../dist/jira/adf.js';

test('looksLikeAdfDoc detects ADF-ish objects', () => {
  assert.equal(looksLikeAdfDoc({ type: 'doc', version: 1, content: [] }), true);
  assert.equal(looksLikeAdfDoc({ version: 1, content: [] }), true);
  assert.equal(looksLikeAdfDoc({ content: [] }), true);
  assert.equal(looksLikeAdfDoc('nope'), false);
  assert.equal(looksLikeAdfDoc(null), false);
});

test('assertValidAdfDoc accepts valid doc', () => {
  assert.doesNotThrow(() =>
    assertValidAdfDoc({ type: 'doc', version: 1, content: [{ type: 'paragraph', content: [] }] }, 'field')
  );
});

test('assertValidAdfDoc rejects missing fields', () => {
  assert.throws(() => assertValidAdfDoc({ type: 'doc', version: 1 }, 'field'), /missing array content/);
  assert.throws(() => assertValidAdfDoc({ type: 'doc', content: [] }, 'field'), /missing numeric version/);
  assert.throws(() => assertValidAdfDoc({ version: 1, content: [] }, 'field'), /missing type="doc"/);
});


