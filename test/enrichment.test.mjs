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
  assert.equal(result.jobs[0].officialUrl, 'https://example.com/careers/1');
  assert.equal(result.jobs[0].sourceUrl, source.url);
});

test('adds an official apply link without pretending a short summary is fully verified', () => {
  const source = {
    source: 'adzuna',
    company: 'Example',
    title: 'Product Manager',
    url: 'https://adzuna.example/2',
    sourceUrl: 'https://adzuna.example/2',
    description: 'A long aggregator summary that is still not the official employer description. '.repeat(20),
    preliminary: true
  };
  const result = applyOfficialOverrides([source], [{
    source_url: source.url,
    official_url: 'https://example.com/careers/2'
  }]);
  assert.equal(result.jobs[0].preliminary, true);
  assert.equal(result.jobs[0].officialUrl, 'https://example.com/careers/2');
  assert.equal(result.jobs[0].sourceUrl, source.url);
});

test('marks a false or closed aggregator result for rejection', () => {
  const source = {
    source: 'adzuna',
    company: 'Example',
    title: 'Product Manager',
    url: 'https://adzuna.example/3',
    description: 'Short',
    preliminary: true
  };
  const result = applyOfficialOverrides([source], [{
    source_url: source.url,
    status: 'invalid',
    reason: 'Exact employer listing not found'
  }]);
  assert.equal(result.jobs[0].verificationRejectedReason, 'Exact employer listing not found');
});
