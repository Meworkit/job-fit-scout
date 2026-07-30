import { canonicalUrl, containsAny, matchedPhrases, normalized, stableJobId } from './text.mjs';

const DAY_MS = 86_400_000;

function parseDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function locationDecision(job, config) {
  const location = normalized(job.location);
  const description = normalized(job.description);
  const combined = `${location} ${description}`;
  const rules = config.location ?? {};

  if (containsAny(combined, rules.blocked_phrases)) {
    return { compatible: false, score: 0, reason: 'Explicit location conflict' };
  }

  const allowed = containsAny(location, rules.allowed_phrases);
  const remote = /\bremote\b/.test(location);
  if (remote && !allowed && !containsAny(combined, rules.remote_must_include)) {
    return { compatible: false, score: 0, reason: 'Remote role does not confirm Canadian eligibility' };
  }
  if (!allowed && location) {
    return { compatible: false, score: 0, reason: `Location is outside the configured area: ${job.location}` };
  }
  if (!location) {
    return { compatible: true, score: 0.4, concern: 'Location requires manual confirmation' };
  }
  return { compatible: true, score: 1 };
}

function dateDecision(job, config, now) {
  const timestamp = parseDate(job.postedAt);
  if (!timestamp) return { compatible: true, score: 0.1, ageDays: null, concern: 'Posting date is unconfirmed' };
  const ageDays = Math.max(0, Math.floor((now - timestamp) / DAY_MS));
  if (ageDays > config.maximum_posting_age_days) {
    return { compatible: false, score: 0, ageDays, reason: `Posted ${ageDays} days ago` };
  }
  const freshness = Math.max(0, 1 - ageDays / config.maximum_posting_age_days);
  return { compatible: true, score: 0.2 + freshness * 0.3, ageDays };
}

function technicalConflict(job, config) {
  const text = `${job.title} ${job.description}`;
  const matches = matchedPhrases(text, config.hard_technical_phrases);
  if (!matches.length) return null;
  const lower = normalized(text);
  const mandatory = /\b(required|must have|minimum|expert|advanced|primary responsibility|5\+ years|7\+ years)\b/.test(lower);
  const coreTitle = /\b(engineer|engineering|researcher|infrastructure|cybersecurity)\b/.test(normalized(job.title));
  return mandatory || coreTitle ? `Required deep technical focus: ${matches[0]}` : null;
}

export function hardFilter(job, config, historyIds = new Set(), now = Date.now()) {
  const title = normalized(job.title);
  if (!containsAny(title, config.allowed_title_phrases)) {
    return { accepted: false, reason: 'Unsupported role family' };
  }
  if (containsAny(title, config.excluded_title_phrases)) {
    return { accepted: false, reason: 'Seniority or title is outside the configured range' };
  }

  const completeText = `${job.title} ${job.company} ${job.description}`;
  if (containsAny(completeText, config.excluded_domains)) {
    return { accepted: false, reason: 'Excluded domain' };
  }

  const location = locationDecision(job, config);
  if (!location.compatible) return { accepted: false, reason: location.reason };

  const date = dateDecision(job, config, now);
  if (!date.compatible) return { accepted: false, reason: date.reason };

  const technical = technicalConflict(job, config);
  if (technical) return { accepted: false, reason: technical };

  if (!canonicalUrl(job.url)) return { accepted: false, reason: 'Missing credible application route' };
  if (historyIds.has(stableJobId(job))) return { accepted: false, reason: 'Previously shown job' };

  return { accepted: true, location, date };
}

function roleScore(title, config) {
  const lower = normalized(title);
  if (config.target_titles.some((target) => lower === normalized(target))) return 2.5;
  if (lower.includes('senior product manager')) return 2.5;
  if (lower.includes('product manager')) return 2.3;
  if (lower.includes('product lead')) return 2.1;
  if (lower.includes('product owner')) return 1.9;
  return 1.5;
}

function seniorityScore(title) {
  const lower = normalized(title);
  if (/\bsenior\b/.test(lower)) return 1;
  if (/\blead\b/.test(lower)) return 0.85;
  return 0.8;
}

export function evaluateJob(job, config, cvText, filterContext) {
  const supportedCapabilities = config.strong_capabilities.filter((item) => containsAny(cvText, [item]));
  const capabilityMatches = matchedPhrases(job.description, supportedCapabilities);
  const coverage = supportedCapabilities.length
    ? Math.min(1, capabilityMatches.length / Math.min(7, supportedCapabilities.length))
    : 0;

  const responsibilities = 0.5 + coverage * 2;
  const capabilities = 0.4 + coverage * 1.1;
  const domainMatches = matchedPhrases(`${job.title} ${job.description}`, config.preferred_domains);
  const domain = domainMatches.length ? Math.min(1, 0.55 + domainMatches.length * 0.15) : 0.3;
  const score = round(
    roleScore(job.title, config) +
    responsibilities +
    capabilities +
    domain +
    seniorityScore(job.title) +
    filterContext.location.score +
    filterContext.date.score
  );

  const concerns = [
    filterContext.location.concern,
    filterContext.date.concern,
    domainMatches.length ? null : 'Preferred domain correspondence is limited',
    capabilityMatches.length < 2 ? 'Few CV-supported capabilities are explicit in the listing' : null
  ].filter(Boolean);

  const evidence = capabilityMatches.slice(0, 3);
  return {
    ...job,
    id: stableJobId(job),
    url: canonicalUrl(job.url),
    score: Math.min(10, score),
    category: score >= 8 ? 'Strong match' : 'Possible match',
    ageDays: filterContext.date.ageDays,
    evidence: evidence.length ? evidence : ['Product-management role family'],
    concern: concerns[0] ?? 'No major concern identified'
  };
}

export function assessJobs(jobs, config, cvText, historyIds = new Set(), now = Date.now()) {
  const accepted = [];
  const rejected = [];
  const seenThisRun = new Set();

  for (const job of jobs) {
    const id = stableJobId(job);
    if (seenThisRun.has(id)) {
      rejected.push({ ...job, id, reason: 'Duplicate within this search' });
      continue;
    }
    seenThisRun.add(id);

    const filter = hardFilter(job, config, historyIds, now);
    if (!filter.accepted) {
      rejected.push({ ...job, id, reason: filter.reason });
      continue;
    }

    const evaluated = evaluateJob(job, config, cvText, filter);
    if (evaluated.score < config.minimum_fit_score) {
      rejected.push({ ...evaluated, reason: `Fit score ${evaluated.score} is below ${config.minimum_fit_score}` });
    } else if (evaluated.ageDays === null && evaluated.score < 8) {
      rejected.push({ ...evaluated, reason: 'Unconfirmed date and not a strong match' });
    } else {
      accepted.push(evaluated);
    }
  }

  accepted.sort((a, b) => b.score - a.score || (a.ageDays ?? 999) - (b.ageDays ?? 999));
  return { accepted: accepted.slice(0, config.result_limit), rejected };
}

