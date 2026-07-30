import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fetchJooble } from '../src/providers/jooble.mjs';
import { fetchLocalAlerts } from '../src/providers/local-alerts.mjs';
import { discoverJobs } from '../src/providers/index.mjs';

test('maps Jooble title-search results as preliminary candidates', async () => {
  const previousKey = process.env.JOOBLE_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.JOOBLE_API_KEY = 'test-key';
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {
      keywords: 'Product Manager',
      location: 'Toronto',
      page: 1
    });
    return {
      ok: true,
      json: async () => ({
        jobs: [{
          id: 42,
          title: 'Product Manager',
          company: 'Example Co',
          location: 'Toronto, ON',
          updated: '2026-07-29T00:00:00Z',
          link: 'https://example.com/jobs/42',
          snippet: 'Build and grow a digital product.'
        }]
      })
    };
  };

  try {
    const jobs = await fetchJooble({
      queries: ['Product Manager'],
      location: 'Toronto',
      pages: 1
    });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].source, 'jooble');
    assert.equal(jobs[0].preliminary, true);
    assert.equal(jobs[0].company, 'Example Co');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.JOOBLE_API_KEY;
    else process.env.JOOBLE_API_KEY = previousKey;
  }
});

test('imports product-role links from a saved local alert', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'job-fit-alerts-'));
  try {
    await writeFile(
      path.join(directory, 'alert.html'),
      '<a href="https://example.com/jobs/7">Senior Product Manager</a>' +
        '<a href="https://example.com/jobs/8">Product Designer</a>'
    );
    const jobs = await fetchLocalAlerts({ directory });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].title, 'Senior Product Manager');
    assert.equal(jobs[0].preliminary, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('reports optional sources as skipped when credentials are absent', async () => {
  const variable = 'JOB_FIT_SCOUT_TEST_MISSING_KEY';
  const previous = process.env[variable];
  delete process.env[variable];
  const messages = [];
  try {
    const result = await discoverJobs({
      jooble: [{
        name: 'Optional Jooble',
        requires_env: variable,
        queries: ['Product Manager']
      }],
      alerts: [{ name: 'Disabled alerts', enabled: false }]
    }, {
      log: (message) => messages.push(message),
      warn: (message) => messages.push(message)
    });
    assert.deepEqual(result.stats, { configured: 2, attempted: 0, skipped: 2 });
    assert.equal(result.jobs.length, 0);
    assert.match(messages[0], /skipped/);
  } finally {
    if (previous !== undefined) process.env[variable] = previous;
  }
});
