import { fetchAshby } from './ashby.mjs';
import { fetchGreenhouse } from './greenhouse.mjs';
import { fetchLever } from './lever.mjs';

const providers = {
  ashby: fetchAshby,
  greenhouse: fetchGreenhouse,
  lever: fetchLever
};

export async function discoverJobs(sourceConfig = {}, logger = console) {
  const jobs = [];
  const errors = [];

  for (const [source, boards] of Object.entries(sourceConfig)) {
    if (source.startsWith('_')) continue;
    const provider = providers[source];
    if (!provider) {
      errors.push({ source, error: 'Unsupported source' });
      continue;
    }
    for (const board of Array.isArray(boards) ? boards : []) {
      try {
        const found = await provider(board);
        jobs.push(...found);
        logger.log(`✓ ${board.company}: ${found.length} active listings`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ source, company: board.company, error: message });
        logger.warn(`⚠ ${board.company}: ${message}`);
      }
    }
  }

  return { jobs, errors };
}

