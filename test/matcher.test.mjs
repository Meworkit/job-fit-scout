import test from 'node:test';
import assert from 'node:assert/strict';
import { assessJobs, compareFreshness, hardFilter } from '../src/lib/matcher.mjs';

const config = {
  target_titles: ['Senior Product Manager', 'Product Manager', 'Product Lead'],
  allowed_title_phrases: ['product manager', 'product owner', 'product lead'],
  excluded_title_phrases: ['junior', 'associate product manager', 'director', 'head of product'],
  location: {
    allowed_phrases: ['toronto', 'ontario', 'canada'],
    blocked_phrases: ['us only', 'united states only'],
    remote_must_include: ['canada', 'canadian']
  },
  preferred_domains: ['ai', 'saas', 'consumer', 'education'],
  excluded_domains: ['gambling', 'crypto'],
  excluded_companies: ['Localcoin'],
  strong_capabilities: ['product discovery', 'customer interviews', 'onboarding', 'activation', 'retention', 'experimentation'],
  hard_technical_phrases: ['machine learning engineer', 'advanced sql'],
  maximum_posting_age_days: 14,
  minimum_fit_score: 6.5,
  result_limit: 20
};

const cv = 'Product discovery, customer interviews, onboarding, activation, retention, experimentation.';
const now = Date.parse('2026-07-30T12:00:00Z');

function job(overrides = {}) {
  return {
    source: 'greenhouse',
    sourceId: '123',
    company: 'Example',
    title: 'Senior Product Manager',
    location: 'Toronto, Ontario, Canada',
    postedAt: '2026-07-27T12:00:00Z',
    url: 'https://boards.greenhouse.io/example/jobs/123',
    description: 'Lead AI SaaS product discovery, customer interviews, onboarding, activation, retention, and experimentation.',
    ...overrides
  };
}

test('accepts a current Toronto Product Manager job', () => {
  assert.equal(hardFilter(job(), config, new Set(), now).accepted, true);
});

test('rejects unsupported role family', () => {
  const result = hardFilter(job({ title: 'Product Designer' }), config, new Set(), now);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /role family/i);
});

test('rejects junior seniority', () => {
  const result = hardFilter(job({ title: 'Junior Product Manager' }), config, new Set(), now);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /seniority/i);
});

test('rejects Canada-incompatible remote roles', () => {
  const result = hardFilter(job({
    location: 'Remote — US only',
    description: 'Candidates must live in the United States.'
  }), config, new Set(), now);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /location/i);
});

test('rejects postings older than configured limit', () => {
  const result = hardFilter(job({ postedAt: '2026-07-01T12:00:00Z' }), config, new Set(), now);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /days ago/i);
});

test('uses 15–20 day jobs only as an extended freshness pool', () => {
  const adaptive = { ...config, preferred_posting_age_days: 14, maximum_posting_age_days: 20, minimum_result_target: 15 };
  const result = assessJobs([job({ postedAt: '2026-07-13T12:00:00Z' })], adaptive, cv, new Set(), now);
  assert.equal(result.accepted.length, 1);
  assert.match(result.accepted[0].concern, /extended freshness/i);
});

test('rejects previously shown stable IDs', () => {
  const result = hardFilter(job(), config, new Set(['greenhouse:123']), now);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /previously shown/i);
});

test('rejects a known excluded company even when a short summary omits its domain', () => {
  const result = hardFilter(job({ company: 'Localcoin', description: 'Short summary' }), config, new Set(), now);
  assert.equal(result.accepted, false);
  assert.match(result.reason, /excluded company/i);
});

test('ranks a CV-supported role as a strong match', () => {
  const result = assessJobs([job()], config, cv, new Set(), now);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].category, 'Strong match');
  assert.ok(result.accepted[0].score >= 8);
});

test('keeps rejected jobs with reasons outside the main result set', () => {
  const result = assessJobs([job({ title: 'Director of Product' })], config, cv, new Set(), now);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].reason);
});

test('deduplicates identical source IDs in one run', () => {
  const result = assessJobs([job(), job()], config, cv, new Set(), now);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected[0].reason, 'Duplicate within this search');
});

test('keeps incomplete aggregator summaries as preliminary even below threshold', () => {
  const result = assessJobs([
    job({
      source: 'adzuna',
      sourceId: 'adz-1',
      url: 'https://www.adzuna.ca/details/1',
      sourceUrl: 'https://www.adzuna.ca/details/1?utm_source=private-id',
      description: 'Short summary.',
      preliminary: true
    })
  ], config, cv, new Set(), now);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.preliminary.length, 1);
  assert.equal(result.preliminary[0].category, 'Preliminary candidate');
  assert.equal(result.preliminary[0].sourceUrl, 'https://www.adzuna.ca/details/1');
});

test('fills the configured result limit with ranked preliminary candidates', () => {
  const jobs = Array.from({ length: 5 }, (_, index) => job({
    source: 'adzuna',
    sourceId: `adz-${index}`,
    company: `Example ${index}`,
    url: `https://www.adzuna.ca/details/${index}`,
    postedAt: `2026-07-${String(29 - index).padStart(2, '0')}T12:00:00Z`,
    description: 'Short summary.',
    preliminary: true
  }));
  const result = assessJobs(jobs, { ...config, result_limit: 4, minimum_result_target: 3 }, cv, new Set(), now);
  assert.equal(result.preliminary.length, 4);
});

test('does not let an incompatible duplicate block a compatible location', () => {
  const result = assessJobs([
    job({ sourceId: 'us', location: 'Remote — US only' }),
    job({ sourceId: 'ca', location: 'Toronto, Ontario, Canada' })
  ], config, cv, new Set(), now);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].sourceId, 'ca');
});

test('reports a transparent funnel', () => {
  const result = assessJobs([job()], config, cv, new Set(), now);
  assert.equal(result.funnel.discovered, 1);
  assert.equal(result.funnel.productRoleCandidates, 1);
  assert.equal(result.funnel.verifiedMatches, 1);
});

test('orders the final view by posting freshness before score', () => {
  const newer = { score: 6.5, ageDays: 1, postedAt: '2026-07-29T12:00:00Z', preliminary: true };
  const older = { score: 9.5, ageDays: 1, postedAt: '2026-07-28T22:00:00Z', preliminary: false };
  assert.deepEqual([older, newer].sort(compareFreshness), [newer, older]);
});
