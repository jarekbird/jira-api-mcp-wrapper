import test from 'node:test';
import assert from 'node:assert/strict';

import { assertValidAdfDoc, looksLikeAdfDoc } from '../../dist/jira/adf.js';

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

test('assertValidAdfDoc rejects non-object inputs with field name in the message', () => {
  assert.throws(() => assertValidAdfDoc('not an object', 'description'), (err) => {
    return err.message.includes('Field "description"') && err.message.includes('expected to be an ADF doc object');
  });
  assert.throws(() => assertValidAdfDoc(null, 'comment'), (err) => {
    return err.message.includes('Field "comment"') && err.message.includes('expected to be an ADF doc object');
  });
  assert.throws(() => assertValidAdfDoc(123, 'summary'), (err) => {
    return err.message.includes('Field "summary"') && err.message.includes('expected to be an ADF doc object');
  });
  // Arrays are objects in JS, so they fail on missing type="doc" instead
  assert.throws(() => assertValidAdfDoc([], 'field'), /Field "field".*missing type="doc"/);
});

test('looksLikeAdfDoc does not treat arrays as ADF docs', () => {
  assert.equal(looksLikeAdfDoc([]), false, 'empty array should not be treated as ADF doc');
  assert.equal(looksLikeAdfDoc([1, 2, 3]), false, 'array of numbers should not be treated as ADF doc');
  assert.equal(looksLikeAdfDoc([{ type: 'paragraph' }]), false, 'array of objects should not be treated as ADF doc');
  // Documented behavior: looksLikeAdfDoc checks for object with 'content' property, not arrays
});


