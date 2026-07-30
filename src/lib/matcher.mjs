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
  const extended = Number.isFinite(config.preferred_posting_age_days) &&
    ageDays > config.preferred_posting_age_days;
  return {
    compatible: true,
    score: 0.2 + freshness * 0.3,
    ageDays,
    extended,
    concern: extended ? `Extended freshness window: posted ${ageDays} days ago` : null
  };
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
  if (job.verificationRejectedReason) {
    return { accepted: false, reason: job.verificationRejectedReason };
  }
  const title = normalized(job.title);
  if (!containsAny(title, config.allowed_title_phrases)) {
    return { accepted: false, reason: 'Unsupported role family' };
  }
  if (containsAny(title, config.excluded_title_phrases)) {
    return { accepted: false, reason: 'Seniority or title is outside the configured range' };
  }
  if (containsAny(job.company, config.excluded_companies ?? [])) {
    return { accepted: false, reason: 'Excluded company or known excluded domain' };
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
    job.preliminary && job.officialUrl ? 'Official employer application found; full description not yet evaluated' : null,
    job.preliminary && !job.officialUrl ? 'Preliminary match from an aggregator summary; exact employer application not yet verified' : null,
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
    officialUrl: canonicalUrl(job.officialUrl),
    sourceUrl: canonicalUrl(job.sourceUrl),
    score: Math.min(10, score),
    category: job.preliminary ? 'Preliminary candidate' : score >= 8 ? 'Strong match' : 'Possible match',
    ageDays: filterContext.date.ageDays,
    evidence: evidence.length ? evidence : ['Product-management role family'],
    concern: concerns[0] ?? 'No major concern identified'
  };
}

function tokenSet(value) {
  return new Set(normalized(value).split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function jaccard(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function isDuplicate(job, existing) {
  const id = stableJobId(job);
  const url = canonicalUrl(job.url);
  return existing.some((candidate) => {
    if (stableJobId(candidate) === id) return true;
    if (url && canonicalUrl(candidate.url) === url) return true;
    const sameCompany = normalized(candidate.company) === normalized(job.company);
    const sameTitle = normalized(candidate.title) === normalized(job.title);
    if (!sameCompany || !sameTitle) return false;
    const sameLocation = normalized(candidate.location) === normalized(job.location);
    return sameLocation || jaccard(candidate.description, job.description) >= 0.65;
  });
}

export function compareFreshness(left, right) {
  const leftTimestamp = parseDate(left.postedAt);
  const rightTimestamp = parseDate(right.postedAt);
  if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }
  if (leftTimestamp !== null && rightTimestamp === null) return -1;
  if (leftTimestamp === null && rightTimestamp !== null) return 1;
  const leftAge = left.ageDays ?? Number.POSITIVE_INFINITY;
  const rightAge = right.ageDays ?? Number.POSITIVE_INFINITY;
  return leftAge - rightAge ||
    Number(Boolean(left.preliminary)) - Number(Boolean(right.preliminary)) ||
    right.score - left.score;
}

function rejectionGroup(reason) {
  if (/location|remote role/i.test(reason)) return 'location';
  if (/posted \d+ days/i.test(reason)) return 'postingAge';
  if (/duplicate/i.test(reason)) return 'duplicates';
  if (/previously shown/i.test(reason)) return 'previouslyShown';
  if (/seniority/i.test(reason)) return 'seniority';
  if (/role family/i.test(reason)) return 'roleFamily';
  if (/excluded domain/i.test(reason)) return 'excludedDomain';
  if (/excluded company/i.test(reason)) return 'excludedDomain';
  if (/technical/i.test(reason)) return 'technical';
  if (/fit score/i.test(reason)) return 'belowScore';
  return 'other';
}

export function assessJobs(jobs, config, cvText, historyIds = new Set(), now = Date.now()) {
  const verified = [];
  const preliminary = [];
  const rejected = [];
  const retainedCandidates = [];
  const funnel = {
    discovered: jobs.length,
    productRoleCandidates: 0,
    uniqueCandidates: 0,
    hardCompatible: 0,
    verifiedEvaluated: 0,
    verifiedMatches: 0,
    preliminaryCandidates: 0,
    rejectedByReason: {}
  };

  const officialFirst = [...jobs].sort((a, b) => Number(Boolean(a.preliminary)) - Number(Boolean(b.preliminary)));
  for (const job of officialFirst) {
    if (containsAny(job.title, config.allowed_title_phrases)) funnel.productRoleCandidates += 1;
    const id = stableJobId(job);

    const filter = hardFilter(job, config, historyIds, now);
    if (!filter.accepted) {
      rejected.push({ ...job, id, reason: filter.reason });
      const group = rejectionGroup(filter.reason);
      funnel.rejectedByReason[group] = (funnel.rejectedByReason[group] ?? 0) + 1;
      continue;
    }
    if (isDuplicate(job, retainedCandidates)) {
      rejected.push({ ...job, id, reason: 'Duplicate within this search' });
      funnel.rejectedByReason.duplicates = (funnel.rejectedByReason.duplicates ?? 0) + 1;
      continue;
    }
    retainedCandidates.push(job);
    funnel.uniqueCandidates += 1;
    funnel.hardCompatible += 1;

    const evaluated = evaluateJob(job, config, cvText, filter);
    if (job.preliminary) {
      preliminary.push(evaluated);
      funnel.preliminaryCandidates += 1;
    } else if (evaluated.score < config.minimum_fit_score) {
      rejected.push({ ...evaluated, reason: `Fit score ${evaluated.score} is below ${config.minimum_fit_score}` });
      funnel.rejectedByReason.belowScore = (funnel.rejectedByReason.belowScore ?? 0) + 1;
    } else if (evaluated.ageDays === null && evaluated.score < 8) {
      rejected.push({ ...evaluated, reason: 'Unconfirmed date and not a strong match' });
      funnel.rejectedByReason.other = (funnel.rejectedByReason.other ?? 0) + 1;
    } else {
      verified.push(evaluated);
      funnel.verifiedMatches += 1;
    }
    if (!job.preliminary) funnel.verifiedEvaluated += 1;
  }

  verified.sort((a, b) => b.score - a.score || (a.ageDays ?? 999) - (b.ageDays ?? 999));
  preliminary.sort(compareFreshness);
  const preferredAge = config.preferred_posting_age_days ?? config.maximum_posting_age_days;
  const primary = verified.filter((job) => job.ageDays === null || job.ageDays <= preferredAge);
  const extended = verified.filter((job) => job.ageDays !== null && job.ageDays > preferredAge);
  const target = Math.min(config.result_limit, config.minimum_result_target ?? config.result_limit);
  const selectedVerified = primary.slice(0, config.result_limit);
  if (selectedVerified.length < target) {
    selectedVerified.push(...extended.slice(0, target - selectedVerified.length));
  }
  const preliminarySpaces = Math.max(0, config.result_limit - selectedVerified.length);
  const selectedPreliminary = preliminary.slice(0, preliminarySpaces);
  return {
    accepted: selectedVerified,
    verified: selectedVerified,
    preliminary: selectedPreliminary,
    rejected,
    funnel
  };
}
