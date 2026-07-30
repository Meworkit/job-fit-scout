import { fetchJson } from '../lib/http.mjs';
import { cleanText } from '../lib/text.mjs';

export async function fetchGreenhouse(board) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.slug)}/jobs?content=true`;
  const payload = await fetchJson(url);
  return (payload.jobs ?? []).map((job) => ({
    source: 'greenhouse',
    sourceId: String(job.id),
    company: board.company,
    title: cleanText(job.title),
    location: cleanText(job.location?.name),
    postedAt: job.first_published ?? job.updated_at ?? null,
    url: job.absolute_url,
    description: cleanText(job.content)
  }));
}

