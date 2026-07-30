import { canonicalUrl, normalized } from './text.mjs';

function matches(job, override) {
  if (override.source_url && canonicalUrl(override.source_url) === canonicalUrl(job.url)) return true;
  return normalized(override.company) === normalized(job.company) &&
    normalized(override.title) === normalized(job.title);
}

export function applyOfficialOverrides(jobs, overrides = []) {
  let enrichedCount = 0;
  const enriched = jobs.map((job) => {
    if (!job.preliminary) return job;
    const override = overrides.find((entry) => matches(job, entry));
    if (!override?.official_url) return job;
    const description = override.description || job.description;
    const verified = normalized(description).length >= 300;
    if (verified) enrichedCount += 1;
    return {
      ...job,
      source: verified ? 'official-enrichment' : job.source,
      sourceId: override.official_url,
      url: override.official_url,
      location: override.location || job.location,
      postedAt: override.posted_at || job.postedAt,
      description,
      preliminary: !verified
    };
  });
  return { jobs: enriched, enrichedCount };
}

