import { fetchAdzuna } from './adzuna.mjs';
import { fetchAshby } from './ashby.mjs';
import { fetchGreenhouse } from './greenhouse.mjs';
import { fetchLever } from './lever.mjs';
import { fetchJooble } from './jooble.mjs';
import { fetchLocalAlerts } from './local-alerts.mjs';

const providers = {
  adzuna: fetchAdzuna,
  ashby: fetchAshby,
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  jooble: fetchJooble,
  alerts: fetchLocalAlerts
};

export async function discoverJobs(sourceConfig = {}, logger = console) {
  const jobs = [];
  const errors = [];
  const stats = { configured: 0, attempted: 0, skipped: 0 };

  for (const [source, boards] of Object.entries(sourceConfig)) {
    if (source.startsWith('_')) continue;
    const provider = providers[source];
    if (!provider) {
      errors.push({ source, error: 'Unsupported source' });
      continue;
    }
    for (const board of Array.isArray(boards) ? boards : []) {
      stats.configured += 1;
      if (board.enabled === false) {
        stats.skipped += 1;
        continue;
      }
      if (board.requires_env && !process.env[board.requires_env]) {
        stats.skipped += 1;
        logger.log(`○ ${board.name ?? source}: skipped until ${board.requires_env} is configured`);
        continue;
      }
      stats.attempted += 1;
      try {
        const found = await provider(board);
        jobs.push(...found);
        logger.log(`✓ ${board.company ?? board.name ?? source}: ${found.length} title-matched listings`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const label = board.company ?? board.name ?? source;
        errors.push({ source, company: label, error: message });
        logger.warn(`⚠ ${label}: ${message}`);
      }
    }
  }

  return { jobs, errors, stats };
}
