import { fetchJson } from '../lib/http.mjs';
import { cleanText } from '../lib/text.mjs';

export function buildAdzunaUrl(search, query, page, credentials) {
  const country = search.country ?? 'ca';
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/${page}`);
  url.searchParams.set('app_id', credentials.appId);
  url.searchParams.set('app_key', credentials.appKey);
  url.searchParams.set('results_per_page', String(search.results_per_page ?? 50));
  url.searchParams.set('what', query);
  url.searchParams.set('where', search.location ?? 'Toronto');
  url.searchParams.set('max_days_old', String(search.maximum_posting_age_days ?? 20));
  url.searchParams.set('sort_by', 'date');
  url.searchParams.set('content-type', 'application/json');
  return url;
}

export async function fetchAdzuna(search) {
  const credentials = {
    appId: process.env.ADZUNA_APP_ID,
    appKey: process.env.ADZUNA_APP_KEY
  };
  if (!credentials.appId || !credentials.appKey) {
    throw new Error('Not configured — run npm run configure:adzuna');
  }

  const queries = Array.isArray(search.queries) ? search.queries : ['Product Manager'];
  const pages = Math.max(1, Math.min(Number(search.pages) || 1, 5));
  const jobs = [];

  for (const query of queries) {
    for (let page = 1; page <= pages; page += 1) {
      const payload = await fetchJson(buildAdzunaUrl(search, query, page, credentials));
      for (const job of payload.results ?? []) {
        jobs.push({
          source: 'adzuna',
          sourceId: String(job.id ?? job.redirect_url),
          company: cleanText(job.company?.display_name ?? 'Unknown company'),
          title: cleanText(job.title),
          location: cleanText(job.location?.display_name),
          postedAt: job.created ?? null,
          url: job.redirect_url,
          description: cleanText(job.description),
          preliminary: true
        });
      }
      if ((payload.results ?? []).length < (search.results_per_page ?? 50)) break;
    }
  }
  return jobs;
}
