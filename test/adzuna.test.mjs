import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdzunaUrl } from '../src/providers/adzuna.mjs';

test('builds a title-first Canadian Adzuna query', () => {
  const url = buildAdzunaUrl({
    country: 'ca',
    location: 'Toronto',
    results_per_page: 50,
    maximum_posting_age_days: 20
  }, 'Senior Product Manager', 1, { appId: 'test-id', appKey: 'test-key' });
  assert.equal(url.hostname, 'api.adzuna.com');
  assert.equal(url.searchParams.get('what'), 'Senior Product Manager');
  assert.equal(url.searchParams.get('where'), 'Toronto');
  assert.equal(url.searchParams.get('max_days_old'), '20');
});

