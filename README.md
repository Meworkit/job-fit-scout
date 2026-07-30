# Job Fit Scout

Job Fit Scout finds current public job listings, checks every listing against a
private CV and personal filters, and returns only credible matches.

It is intentionally **not** an application tracker, CV generator, cover-letter
writer, or automatic application system.

## Privacy

The following stay only on your computer and are excluded from Git:

- Your real CV
- Your private configuration
- Search history
- Downloaded or generated data
- Result and rejection files
- Environment variables

Before every upload to GitHub, check that `git status` does not show files from
`private/`, `data/`, `output/`, or `config/user.json`.

## First-time setup

### 1. Install Node.js

Job Fit Scout needs Node.js 20 or newer. Check it with:

```text
node --version
```

### 2. Create private local settings

From this project folder, run:

```text
npm run setup
```

This creates `config/user.json`. It is safe to edit and cannot be uploaded to
Git accidentally because `.gitignore` excludes it.

### 3. Add the CV

Save a plain-text Markdown copy of the CV as:

```text
private/cv.md
```

Do not place the CV elsewhere in the repository.

### 4. Adjust the search

Open `config/user.json`. The most commonly changed settings are:

- `target_titles`
- `allowed_title_phrases`
- `location`
- `preferred_domains`
- `excluded_domains`
- `maximum_posting_age_days`
- `minimum_fit_score`
- `result_limit`
- `sources`

The default settings search Toronto, the Greater Toronto Area, and remote roles
explicitly open to Canada. It prefers postings up to 14 days old and uses days
15–20 only when fewer than 15 suitable jobs are available.

### 5. Connect title-first Adzuna discovery

Create an Adzuna developer application, then run:

```text
npm run configure:adzuna
```

Enter the Application ID and regenerated Application Key directly in Terminal.
The key is hidden while typing and saved only in `.env`, which Git excludes.
Never paste an API key into chat or commit it to GitHub.

### 6. Optionally connect Jooble

Create a Jooble API key, then run:

```text
npm run configure:jooble
```

The key is hidden while typing and saved beside the Adzuna credentials in the
private `.env` file. Searches continue normally when Jooble is not configured.

### 7. Add links from job alerts

Save LinkedIn, Indeed, Glassdoor, Wellfound, or other job-alert emails as
`.eml`, `.html`, or `.txt` files inside:

```text
private/alerts/
```

Job Fit Scout reads Product Manager-family links from these local files. It
does not sign in to or automate those services.

### 8. Verify an aggregator candidate

Copy `config/official-links.example.json` to
`private/official-links.json`. For an Adzuna or Jooble candidate, add the
official employer URL and full job description. On the next search, Job Fit
Scout evaluates that complete posting as a verified candidate.

## Running a search

```text
npm run search
```

Job Fit Scout writes:

- `output/job-search-latest.md` — readable table
- `output/job-search-latest.csv` — spreadsheet-ready results
- `data/rejected-jobs.csv` — rejected jobs and exact reasons
- `data/search-history.json` — jobs previously shown

To test a search without adding jobs to history:

```text
npm run search:dry
```

## How matching works

The tool first applies hard rules:

- Correct role family
- Supported seniority
- Compatible Canadian location
- Not older than the configured limit
- No explicitly excluded domain
- No clearly mandatory deep-technical conflict
- Valid application URL
- Not a duplicate or previously shown job

Remaining complete jobs receive a transparent score from 0 to 10 based on:

- Role-family fit: 25%
- Responsibility correspondence: 25%
- CV-supported product capabilities: 15%
- Preferred domain: 10%
- Seniority: 10%
- Location and authorization: 10%
- Recency: 5%

Domain preferences and ordinary skill gaps change ranking rather than
automatically rejecting a job. A hard conflict always overrides the score.
Incomplete aggregator or alert summaries are never rejected for a low score;
they remain clearly labeled as **Preliminary candidates** until the official
full posting is available. The shortlist is ordered by exact posting time, with
the freshest jobs first.

## Job sources

Version 1 uses title-first Adzuna search plus public employer job-board
interfaces:

- Adzuna
- Jooble (optional)
- Greenhouse
- Lever
- Ashby

Add company boards in `config/user.json`. For example, if a public board is
`https://jobs.ashbyhq.com/example`, its slug is `example`.

One failing company does not stop the rest of the search. The tool does not log
in to, bypass protections on, or directly scrape LinkedIn, Indeed, or Glassdoor.

The number of results depends on the configured company boards. Adding more
relevant employers expands coverage without weakening matching criteria.

## Tests

```text
npm test
```

Tests cover title filtering, seniority, Canadian location rules, posting age,
scoring, history, duplicate detection, Adzuna, Jooble, saved alerts, and
official-posting enrichment.

## Important limitation

The score is a transparent screening aid, not a hiring probability. Public job
data can be incomplete, and an employer may change or close a listing between
searches. Always confirm important details on the application page.
