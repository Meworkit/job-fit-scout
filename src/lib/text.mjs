export function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalized(value = '') {
  return cleanText(value).toLowerCase();
}

export function containsAny(text, phrases = []) {
  const haystack = normalized(text);
  return phrases.some((phrase) => haystack.includes(normalized(phrase)));
}

export function matchedPhrases(text, phrases = []) {
  const haystack = normalized(text);
  return phrases.filter((phrase) => haystack.includes(normalized(phrase)));
}

export function canonicalUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|source$|ref$|gh_src$)/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function stableJobId(job) {
  if (job.sourceId) return `${job.source}:${job.sourceId}`;
  return canonicalUrl(job.url) || `${normalized(job.company)}::${normalized(job.title)}`;
}

