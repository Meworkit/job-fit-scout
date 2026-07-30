import { fetchJson } from '../lib/http.mjs';
import { cleanText } from '../lib/text.mjs';

export async function fetchAshby(board) {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.slug)}?includeCompensation=true`;
  const payload = await fetchJson(url);
  return (payload.jobs ?? []).map((job) => ({
    source: 'ashby',
    sourceId: String(job.id ?? job.jobUrl),
    company: board.company,
    title: cleanText(job.title),
    location: cleanText(job.location),
    postedAt: job.publishedAt ?? null,
    url: job.jobUrl ?? job.applyUrl,
    description: cleanText(job.descriptionPlain ?? job.descriptionHtml ?? job.description)
  }));
}

