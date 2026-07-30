import { cleanText } from '../lib/text.mjs';

export async function fetchJooble(search) {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) throw new Error('Not configured — run npm run configure:jooble');
  const jobs = [];
  const queries = Array.isArray(search.queries) ? search.queries : [search.query ?? 'Product Manager'];
  const pages = Math.max(1, Math.min(Number(search.pages) || 1, 5));
  for (const query of queries) {
    for (let page = 1; page <= pages; page += 1) {
      const response = await fetch(`https://jooble.org/api/${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Job-Fit-Scout/0.2 (personal job search)'
        },
        body: JSON.stringify({
          keywords: query,
          location: search.location ?? 'Toronto',
          page
        }),
        signal: AbortSignal.timeout(20_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      jobs.push(...(payload.jobs ?? []).map((job) => ({
        source: 'jooble',
        sourceId: String(job.id ?? job.link),
        company: cleanText(job.company ?? 'Unknown company'),
        title: cleanText(job.title),
        location: cleanText(job.location),
        postedAt: job.updated ?? null,
        url: job.link,
        sourceUrl: job.link,
        description: cleanText(job.snippet),
        preliminary: true
      })));
    }
  }
  return jobs;
}
