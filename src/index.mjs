#!/usr/bin/env node
import { getPrivateConfig, runSearch } from './search-service.mjs';

const dryRun = process.argv.includes('--dry-run');

try {
  const config = await getPrivateConfig();
  console.log(`\nJob Fit Scout — ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Searching for up to ${config.result_limit} new matches...\n`);
  const { metadata } = await runSearch({ dryRun });
  console.log(`\nDiscovered: ${metadata.discoveredCount}`);
  console.log(`Verified new matches: ${metadata.verifiedCount}`);
  console.log(`Preliminary candidates: ${metadata.preliminaryCount}`);
  console.log(`Total shortlist: ${metadata.suitableCount}`);
  console.log(`Rejected or previously shown: ${metadata.rejectedCount}`);
  console.log(`Source errors: ${metadata.sourceErrorCount}`);
  console.log('Results: output/job-search-latest.md and output/job-search-latest.csv');
  console.log('Diagnostics: data/rejected-jobs.csv');
  if (dryRun) console.log('Dry run: suitable jobs were not added to history.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
