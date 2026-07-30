import { fetchJson } from '../lib/http.mjs';
import { cleanText } from '../lib/text.mjs';

export async function fetchLever(board) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(board.slug)}?mode=json`;
  const payload = await fetchJson(url);
  return (Array.isArray(payload) ? payload : []).map((job) => ({
    source: 'lever',
    sourceId: String(job.id),
    company: board.company,
    title: cleanText(job.text),
    location: cleanText(job.categories?.location),
    postedAt: typeof job.createdAt === 'number' ? new Date(job.createdAt).toISOString() : null,
    url: job.hostedUrl ?? job.applyUrl,
    description: cleanText(job.descriptionPlain ?? job.description)
  }));
}

