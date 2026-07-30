import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw new Error(`Cannot read ${filePath}: ${error.message}`);
  }
}

export async function ensureDirectories() {
  await Promise.all([
    mkdir('data', { recursive: true }),
    mkdir('output', { recursive: true }),
    mkdir('private', { recursive: true })
  ]);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function safeMarkdown(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export async function writeResults(results, metadata) {
  const header = [
    '# Job Fit Scout results',
    '',
    `**Search date:** ${metadata.searchDate}`,
    `**Filters:** ${metadata.filters}`,
    `**Sources checked:** ${metadata.sourcesChecked}`,
    '',
    '| Match | Company | Role | Location | Posted | Application link | Main fit evidence | Main concern |',
    '|---|---|---|---|---|---|---|---|'
  ];
  const rows = results.map((job) => {
    const posted = job.postedAt ? String(job.postedAt).slice(0, 10) : 'Unconfirmed';
    const values = [
      `${job.score}/10 — ${job.category}`,
      job.company,
      `[${safeMarkdown(job.title)}](${job.url})`,
      job.location || 'Unconfirmed',
      posted,
      `[Apply](${job.url})`,
      job.evidence.join(', '),
      job.concern
    ];
    return `| ${values.map(safeMarkdown).join(' | ')} |`;
  });
  if (!rows.length) rows.push('| — | — | No qualifying new jobs found | — | — | — | — | — |');
  await writeFile('output/job-search-latest.md', [...header, ...rows, ''].join('\n'));

  const csvHeader = ['Match', 'Category', 'Company', 'Role', 'Location', 'Posted', 'Application link', 'Main fit evidence', 'Main concern'];
  const csvRows = results.map((job) => [
    job.score,
    job.category,
    job.company,
    job.title,
    job.location,
    job.postedAt ? String(job.postedAt).slice(0, 10) : 'Unconfirmed',
    job.url,
    job.evidence.join('; '),
    job.concern
  ]);
  await writeFile('output/job-search-latest.csv', [csvHeader, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n');
}

export async function writeRejected(rejected, searchDate) {
  const header = ['Search date', 'Company', 'Role', 'Location', 'URL', 'Reason'];
  const rows = rejected.map((job) => [searchDate, job.company, job.title, job.location, job.url, job.reason]);
  await writeFile('data/rejected-jobs.csv', [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n');
}

export async function updateHistory(historyPath, existing, results, searchDate) {
  const shown = { ...(existing.shown ?? {}) };
  for (const job of results) shown[job.id] = { firstShown: searchDate, company: job.company, title: job.title, url: job.url };
  const history = { version: 1, shown };
  await writeFile(historyPath, JSON.stringify(history, null, 2) + '\n');
}

export function absoluteFromProject(relativePath) {
  return path.resolve(process.cwd(), relativePath);
}

