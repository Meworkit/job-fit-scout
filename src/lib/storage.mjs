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

function resultTable(results, emptyMessage) {
  const rows = [
    '| Match | Company | Role | Location | Posted | Application link | Main fit evidence | Main concern |',
    '|---|---|---|---|---|---|---|---|'
  ];
  for (const job of results) {
    const posted = job.postedAt ? String(job.postedAt).slice(0, 10) : 'Unconfirmed';
    const values = [
      `${job.score}/10 — ${job.category}`,
      job.company,
      `[${safeMarkdown(job.title)}](${job.url})`,
      job.location || 'Unconfirmed',
      posted,
      `[Open](${job.url})`,
      job.evidence.join(', '),
      job.concern
    ];
    rows.push(`| ${values.map(safeMarkdown).join(' | ')} |`);
  }
  if (!results.length) rows.push(`| — | — | ${emptyMessage} | — | — | — | — | — |`);
  return rows;
}

export async function writeResults(results, verified, preliminary, metadata) {
  const funnel = metadata.funnel ?? {};
  const header = [
    '# Job Fit Scout results',
    '',
    `**Search date:** ${metadata.searchDate}`,
    `**Filters:** ${metadata.filters}`,
    `**Sources checked:** ${metadata.sourcesChecked} (${metadata.sourcesConfigured ?? metadata.sourcesChecked} configured; ${metadata.sourcesSkipped ?? 0} skipped)`,
    '',
    '## Search funnel',
    '',
    `Discovered ${funnel.discovered ?? metadata.discoveredCount} listings → ${funnel.productRoleCandidates ?? '—'} product-role candidates → ${funnel.uniqueCandidates ?? '—'} unique compatible candidates → ${funnel.verifiedMatches ?? metadata.verifiedCount ?? verified.length} verified + ${funnel.preliminaryCandidates ?? metadata.preliminaryCount ?? preliminary.length} preliminary candidates → ${results.length} shortlisted.`,
    '',
    '## Shortlist — freshest first',
    '',
    'A **Strong/Possible match** uses the complete employer posting. A **Preliminary candidate** passed the hard rules, but its aggregator or alert summary is incomplete and must be confirmed on the employer page.',
    ''
  ];
  const document = [
    ...header,
    ...resultTable(results, 'No suitable new matches'),
    ''
  ];
  await writeFile('output/job-search-latest.md', document.join('\n'));

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
  await writeFile('output/job-search-latest.json', JSON.stringify({
    metadata,
    results,
    verified,
    preliminary
  }, null, 2) + '\n');
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
