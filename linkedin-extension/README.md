# Todo AI LinkedIn Candidate Finder

Recruiter-driven sourcing companion for Todo AI.

## What it does
- Uses the requirement currently selected in Todo AI.
- Opens LinkedIn People Search with role, top mandatory skills, location and an open-to-work search hint.
- Scores only profiles currently visible in the recruiter's LinkedIn results page.
- Shows a Todo AI fit percentage plus a job-search signal: Strong, Possible or Unknown.
- Adds an `Add to Todo AI` button on LinkedIn profile pages.
- Sends the chosen profile back to Todo AI and pre-fills recruiter Quick Screening.
- Quick Screening and LinkedIn sourcing stay recruiter-only.

## What it deliberately does not do
- No background crawling.
- No hidden bulk scraping.
- No automatic outreach or messaging.
- No claim that a person is actively job-seeking unless visible page text provides a signal.

## Install for internal testing
1. Open Chrome/Edge Extensions.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select the `linkedin-extension` folder.
5. Reload LinkedIn once after installation.
6. In Todo AI, login as a recruiter, select a requirement and click **Find candidates on LinkedIn**.

## MVP flow
Todo AI requirement → LinkedIn search → score visible results → open a profile → Add to Todo AI → Quick Screening pre-filled.
