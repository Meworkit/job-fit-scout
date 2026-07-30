import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { cleanText } from '../lib/text.mjs';

function decodeHtml(value) {
  return cleanText(value)
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&');
}

function companyFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return 'Alert source';
  }
}

function extractAnchors(contents, sourceFile) {
  const jobs = [];
  for (const match of contents.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = decodeHtml(match[1]);
    const title = decodeHtml(match[2]);
    if (!/\b(product manager|product owner|product lead|founding product)\b/i.test(title)) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    jobs.push({
      source: 'alerts',
      sourceId: url,
      company: companyFromUrl(url),
      title,
      location: '',
      postedAt: null,
      url,
      description: `Imported from local alert file ${sourceFile}.`,
      preliminary: true
    });
  }
  return jobs;
}

export async function fetchLocalAlerts(entry) {
  const directory = entry.directory ?? 'private/alerts';
  let files;
  try {
    files = await readdir(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const jobs = [];
  for (const file of files.filter((name) => /\.(eml|html?|txt)$/i.test(name))) {
    const contents = await readFile(path.join(directory, file), 'utf8');
    jobs.push(...extractAnchors(contents, file));
  }
  return jobs;
}

