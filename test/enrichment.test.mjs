import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOfficialOverrides } from '../src/lib/enrichment.mjs';

test('promotes a preliminary result only with substantial official text', () => {
  const source = {
    source: 'adzuna',
    company: 'Example',
    title: 'Product Manager',
    url: 'https://adzuna.example/1',
    description: 'Short',
    preliminary: true
  };
  const result = applyOfficialOverrides([source], [{
    source_url: source.url,
    official_url: 'https://example.com/careers/1',
    description: 'Product discovery and customer interviews. '.repeat(20)
  }]);
  assert.equal(result.enrichedCount, 1);
  assert.equal(result.jobs[0].preliminary, false);
  assert.equal(result.jobs[0].url, 'https://example.com/careers/1');
});

