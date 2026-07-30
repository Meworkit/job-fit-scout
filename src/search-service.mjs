import { readFile } from 'node:fs/promises';
import { assessJobs, compareFreshness } from './lib/matcher.mjs';
import { ensureDirectories, readJson, updateHistory, writeRejected, writeResults } from './lib/storage.mjs';
import { discoverJobs } from './providers/index.mjs';
import { loadLocalEnv } from './lib/env.mjs';
import { applyOfficialOverrides } from './lib/enrichment.mjs';

const CONFIG_PATH = 'config/user.json';
const HISTORY_PATH = 'data/search-history.json';

export async function getPrivateConfig() {
  const config = await readJson(CONFIG_PATH, null);
  if (!config) throw new Error('Private configuration is missing. Run npm run setup.');
  return config;
}

export function publicConfig(config) {
  return {
    targetTitles: config.target_titles,
    location: config.location?.label,
    maximumPostingAgeDays: config.maximum_posting_age_days,
    preferredPostingAgeDays: config.preferred_posting_age_days ?? config.maximum_posting_age_days,
    minimumFitScore: config.minimum_fit_score,
    resultLimit: config.result_limit,
    preferredDomains: config.preferred_domains,
    sourceCount: Object.entries(config.sources ?? {})
      .filter(([key]) => !key.startsWith('_'))
      .reduce((sum, [, boards]) => sum + (Array.isArray(boards) ? boards.length : 0), 0)
  };
}

export async function runSearch({ dryRun = false, logger = console } = {}) {
  await ensureDirectories();
  await loadLocalEnv();
  const config = await getPrivateConfig();
  let cvText;
  try {
    cvText = await readFile(config.cv_path, 'utf8');
  } catch {
    throw new Error(`CV not found at ${config.cv_path}.`);
  }

  const searchDate = new Date().toISOString().slice(0, 10);
  const history = await readJson(HISTORY_PATH, { version: 1, shown: {} });
  const historyIds = new Set(Object.keys(history.shown ?? {}));
  const discovered = await discoverJobs(config.sources, logger);
  const overrides = await readJson('private/official-links.json', []);
  const enrichment = applyOfficialOverrides(discovered.jobs, Array.isArray(overrides) ? overrides : []);
  const { verified, preliminary, rejected, funnel } = assessJobs(enrichment.jobs, config, cvText, historyIds);
  const results = [...verified, ...preliminary].sort(compareFreshness);
  const metadata = {
    searchDate,
    filters: `${config.location.label}; prefer ${config.preferred_posting_age_days ?? config.maximum_posting_age_days} days, extend to ${config.maximum_posting_age_days} only if needed; verified minimum ${config.minimum_fit_score}/10`,
    sourcesChecked: discovered.stats.attempted,
    sourcesConfigured: discovered.stats.configured,
    sourcesSkipped: discovered.stats.skipped,
    discoveredCount: discovered.jobs.length,
    suitableCount: results.length,
    verifiedCount: verified.length,
    preliminaryCount: preliminary.length,
    rejectedCount: rejected.length,
    sourceErrorCount: discovered.errors.length,
    officiallyEnrichedCount: enrichment.enrichedCount,
    funnel,
    dryRun
  };

  await writeResults(results, verified, preliminary, metadata);
  await writeRejected(rejected, searchDate);
  if (!dryRun) await updateHistory(HISTORY_PATH, history, results, searchDate);
  return { metadata, results, verified, preliminary, errors: discovered.errors };
}

export async function readLatestResults() {
  return readJson('output/job-search-latest.json', {
    metadata: null,
    results: []
  });
}
