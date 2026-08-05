# n8n AI Workflow Builder prompt — Job Fit Scout

Paste everything below into n8n's AI Workflow Builder. Build the workflow with clear node names and notes. Do not place API keys, email addresses, CV files, or tokens directly in node fields. Use n8n credentials or variables for all private values.

---

Create a production-ready workflow named **Job Fit Scout — Toronto and Remote Europe**.

## Goal

Every day, find new Product Manager jobs that fit one candidate profile, split them into two independent search tracks, remove duplicates and unsuitable senior roles, rank the remaining jobs against the profile, save them to an Excel workbook in OneDrive, and send notifications only for new good matches.

## Candidate profile

- 7+ years in product management across AI-native products, consumer SaaS, EdTech, marketplaces, and growth.
- Strongest experience: product discovery, user interviews, product-market fit, zero-to-one products, founder collaboration, onboarding, activation, retention, conversion optimization, funnel analytics, experimentation, A/B testing, roadmap prioritization, and cross-functional delivery.
- AI experience: prompt engineering, AI product design, workflow automation, LLM product experiences, AI agents, and rapid prototyping.
- Preferred domains: AI, SaaS, consumer products, EdTech, education, productivity, travel and experiences, social connection, wellbeing, mental health, pets, and creator tools.
- Excluded domains: gambling, casino, adult entertainment, cryptocurrency, blockchain, and Web3.
- Do not infer the desired seniority from previous titles on the CV. Follow the seniority rules below.

## Search track A — Toronto / Canada

- Target Toronto and the Greater Toronto Area.
- Allow on-site, hybrid, and remote roles.
- Also allow Canada-wide remote roles when the employer explicitly hires in Canada.
- Reject roles that are remote only in the United States or another country.

## Search track B — Remote Europe

- Target remote roles explicitly open across Europe, the EU, EEA, EMEA, or Portugal.
- The role must be genuinely remote; exclude Europe roles that require regular office attendance outside Portugal.
- If European work eligibility cannot be confirmed from the posting, keep the job but set `Eligibility` to `Confirm` and treat it as a concern.
- Reject country-restricted remote roles outside Portugal unless later configured as eligible.

## Target titles

Include:

- Product Manager
- Digital Product Manager
- Growth Product Manager
- AI Product Manager
- Platform Product Manager
- Consumer Product Manager
- Product Owner
- Technical Product Manager only when the position does not require software engineering, infrastructure, cybersecurity, advanced SQL, or deep ML engineering
- Founding Product Manager
- First Product Manager

Allow title variations only when product management is the primary job function. Do not include Product Designer, Product Marketing Manager, Project Manager, Program Manager, Product Analyst, Product Sales, physical inventory/category Product Manager, or software engineering roles.

## Seniority rules

The preferred ceiling is an experienced individual-contributor Product Manager without a senior leadership title.

Hard-reject titles containing:

- Senior or Sr.
- Lead
- Principal
- Staff
- Group Product Manager
- Director
- Head of Product
- VP or Vice President
- Chief Product Officer
- Manager of Product Managers

Exception: `Founding Product Manager` and `First Product Manager` are allowed even though they may have broad ownership. Flag them as `Founding-role stretch` when the posting expects executive-level leadership, fundraising, hiring a product organization, or more than 8 years of directly relevant experience.

## Freshness and volume

- Prefer jobs posted in the last 14 days.
- Search up to 20 days old only when there are not enough good new matches.
- Never include a role older than 20 days.
- Return up to 20 new jobs per daily digest across both tracks.
- Sort by posting date first, newest to oldest, and match score second.
- Do not weaken the title, location, seniority, or domain exclusions just to reach 20 jobs.

## Sources

1. Call the existing Job Fit Scout service through an HTTP Request node using the variable `JOB_FIT_SCOUT_URL` and an n8n credential for authentication.
2. Send one request for each search track and run the requests in parallel.
3. Use Adzuna, Jooble when configured, and permitted public employer ATS sources already supported by Job Fit Scout.
4. If a general web-search API is configured, search the exact combination of company name, title, and location to locate the employer's official application page.
5. Keep `Official Application Link` and `Discovery Source Link` separate. Never label an aggregator, recruiter copy, general careers page, or a merely similar job as the official application.

## Required processing

Normalize every result into these fields:

- Job ID
- Search Track
- Date Found
- Posted Date
- Company
- Job Title
- Seniority Check
- Location
- Arrangement
- Eligibility
- Match Score from 0 to 100
- Match Tier
- Freshness
- Domain Fit
- CV Evidence
- Main Concern
- Official Application Link
- Discovery Source Link
- Notification
- Status
- Date Applied
- Follow-up Date
- Contact
- Notes

Create a stable Job ID from the source ID when available; otherwise use a normalized combination of company, title, and location. Canonicalize URLs by removing tracking parameters. Remove duplicates across sources and across previous workflow executions. If the same role appears more than once, keep the employer posting as the primary version.

Apply hard filters before AI scoring. Do not spend an AI call on jobs that fail title, location, age, seniority, or excluded-domain rules.

For accepted jobs, calculate the Match Score using:

- Role and responsibility alignment: 30 points
- Evidence of the candidate's strongest capabilities: 25 points
- Domain correspondence: 20 points
- Appropriate individual-contributor seniority: 15 points
- Location and hiring eligibility: 10 points

Match tiers:

- 85–100: Strong
- 70–84: Good
- 55–69: Stretch
- Below 55: Low; do not notify

For `CV Evidence`, provide two or three short, specific correspondences between the posting and the candidate's experience. Never invent experience. Put missing or unsupported requirements in `Main Concern`.

## Excel storage

Use the Microsoft Excel 365 node with a workbook stored in OneDrive named `Job_Fit_Scout_Tracker.xlsx`. Append new rows to the table named `JobMatchesTable` on the `Job Matches` sheet. Before appending, look up the Job ID and do not add an existing role again. Preserve user-edited fields such as Status, Date Applied, Follow-up Date, Contact, and Notes.

If the Microsoft Excel 365 node is unavailable, stop with a clear configuration error rather than silently replacing the workbook with another storage system.

## Notifications

- Send an immediate email when a new job scores 85 or higher and was posted within the last 3 days.
- Send one daily email digest at 08:00 in the `Europe/Lisbon` timezone containing up to 20 new jobs with scores of 70 or higher.
- Group the digest into `Toronto / Canada` and `Remote Europe` sections.
- Within each section, show: score, company, title, location, posting date, two CV evidence bullets, main concern, and the official application link.
- If the official link is not verified, say `Official application link not yet verified` and provide the discovery link separately.
- Do not notify about the same Job ID more than once.
- If there are no new good matches, send no digest. Record a successful zero-result run in execution data.

Use Gmail for notification with an n8n Gmail credential and the variable `USER_NOTIFICATION_EMAIL`. Do not expose the address inside workflow exports.

## Reliability and privacy

- Add an Error Trigger workflow that emails a short failure report containing the failed node name, search track, execution URL, and error message. Do not include the CV or API credentials in the error email.
- Configure retries with backoff for rate limits and temporary HTTP errors.
- Keep the original CV outside the workflow. Use only the structured candidate profile above or retrieve a private profile from the Job Fit Scout service.
- Do not save full API responses when they contain private values.
- Add workflow notes indicating which credentials and variables the user must configure manually.

## Required final workflow shape

Schedule Trigger -> Define Search Rules -> two parallel Job Fit Scout search requests -> Merge -> Normalize -> Hard Filters -> Remove Duplicates -> Match Scoring -> Split Immediate Alerts / Daily Digest -> Append New Rows to Excel -> Send Emails -> Mark Notification Sent.

Also create a Manual Trigger path for testing. During manual tests, limit each search track to five jobs and prefix emails with `[TEST]`.

---

After n8n builds the workflow, it must leave credential selectors unconfigured and clearly identify the required setup: `JOB_FIT_SCOUT_URL`, Job Fit Scout authentication, Microsoft Excel 365/OneDrive credential, Gmail credential, and `USER_NOTIFICATION_EMAIL`.
