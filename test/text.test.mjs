import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalUrl } from '../src/lib/text.mjs';

test('removes tracking credentials and attribution parameters from result links', () => {
  const result = canonicalUrl('https://example.com/jobs/1?utm_source=private-id&utm_medium=api&ref=abc&job=7');
  assert.equal(result, 'https://example.com/jobs/1?job=7');
});
