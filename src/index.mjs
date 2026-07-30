#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { assessJobs } from './lib/matcher.mjs';
import { ensureDirectories, readJson, updateHistory, writeRejected, writeResults } from './lib/storage.mjs';
import { discoverJobs } from './providers/index.mjs';

const dryRun = process.argv.includes('--dry-run');
const CONFIG_PATH = 'config/user.json';
const HISTORY_PATH = 'data/search-history.json';

await ensureDirectories();
const config = await readJson(CONFIG_PATH, null);
if (!config) {
  console.error('Private configuration is missing. Run: npm run setup');
  process.exitCode = 1;
} else {
  let cvText;
  try {
    cvText = await readFile(config.cv_path, 'utf8');
  } catch {
    console.error(`CV not found at ${config.cv_path}. Add it there, then search again.`);
    process.exitCode = 1;
  }

  if (cvText) {
    const searchDate = new Date().toISOString().slice(0, 10);
    const history = await readJson(HISTORY_PATH, { version: 1, shown: {} });
    const historyIds = new Set(Object.keys(history.shown ?? {}));

    console.log(`\nJob Fit Scout — ${searchDate}`);
    console.log(`Searching for up to ${config.result_limit} new matches...\n`);
    const discovered = await discoverJobs(config.sources);
    const { accepted, rejected } = assessJobs(discovered.jobs, config, cvText, historyIds);

    await writeResults(accepted, {
      searchDate,
      filters: `${config.location.label}; last ${config.maximum_posting_age_days} days; minimum ${config.minimum_fit_score}/10`,
      sourcesChecked: Object.entries(config.sources)
        .filter(([key]) => !key.startsWith('_'))
        .reduce((sum, [, boards]) => sum + (Array.isArray(boards) ? boards.length : 0), 0)
    });
    await writeRejected(rejected, searchDate);
    if (!dryRun) await updateHistory(HISTORY_PATH, history, accepted, searchDate);

    console.log(`\nDiscovered: ${discovered.jobs.length}`);
    console.log(`Suitable new jobs: ${accepted.length}`);
    console.log(`Rejected or previously shown: ${rejected.length}`);
    console.log(`Source errors: ${discovered.errors.length}`);
    console.log('Results: output/job-search-latest.md and output/job-search-latest.csv');
    console.log('Diagnostics: data/rejected-jobs.csv');
    if (dryRun) console.log('Dry run: suitable jobs were not added to history.');
  }
}

