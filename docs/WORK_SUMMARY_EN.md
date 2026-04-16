# Work Summary — Peizhong Gao Homepage (EN)

**Date:** 2026-04-15  
**Author:** Peizhong (Chill) Gao  
**Deliverables:** static homepage + live Scholar widget + bilingual toggle + docs

## What was built

A static single-page personal homepage for Peizhong, tuned to communicate
three things above everything else:

1. **Identity.** Name, photo, affiliation (GIX / Tsinghua × UW).
2. **Trajectory.** Incoming AI Research Scientist Intern at **[REDACTED]** via
   the **[REDACTED] ([REDACTED])**, Summer 2026; prior work at
   Moonshot AI (Kimi-Researcher + Kimi K2 Data Science capability),
   Microsoft Research Asia (Natural Language Computing Group), and
   Tsinghua Future Lab / AIR.
3. **Impact.** **777** total citations, h-index **7**, **9** publications;
   per-year citation chart pulled live from Google Scholar.

The page is one column on mobile, a 280 px sticky sidebar + flex main
column on desktop. Everything is monochrome grayscale, one typeface
(Source Sans 3), no italics, no accent colors.

## Architectural highlights

- **Zero build step.** Plain HTML + CSS + vanilla JS. `git push` = deploy.
- **Live Google Scholar stats without a server.** A GitHub Actions workflow
  runs once a day with a **two-tier polite poll**: first a lightweight
  plain-browser HTTPS GET of the public profile (one request, looks
  like a human clicking refresh) checks whether the total citation
  count has moved; only when it has does the workflow run the full
  `scholarly` scrape and commit a new `data/scholar.json`. The client
  fetches that file on every page load and animates the numbers. On
  scraping failure, the previous snapshot is preserved so the public
  numbers never flicker to zero.
- **Bilingual (EN / 中) without a second route.** Every translatable node
  carries `data-en` + `data-zh` attributes; a 120-line vanilla-JS toggle
  swaps `textContent` / `innerHTML` in place and persists the choice.
- **Light / dark theme.** OS-preference default, user-overridable,
  persisted. One variable override block covers the whole site.

## Confidentiality & tone

The copy is deliberately **objective, understated, fact-first**. For the
Moonshot AI work, only publicly-documented numbers appear — the
**HLE 8.6% → 26.9%** improvement and the **574** citations on the Kimi K2
Technical Report. All internal process, internal benchmark counts, and
pre-public metrics are omitted. Collaborators are not singled out by name
except where required for a first-authored paper's group affiliation, and
Tsinghua-internal professor names are omitted entirely.

"Owned the Data Science capability" is the emphasized framing for Kimi
K2 / K2 Thinking — parallel to "tools", "reasoning", etc. as capability
verticals within post-training.

## Deliverables in the repo

- `index.html` — the page.
- `styles.css` — monochrome stylesheet.
- `script.js` — theme + language + Scholar fetch + nav spy + reveal.
- `assets/profile.jpg` — headshot from the public Scholar profile.
- `data/scholar.json` — last-synced Scholar snapshot (auto-updated).
- `scripts/fetch_scholar.py` + `requirements.txt` — the scraper.
- `.github/workflows/update-scholar.yml` — 6-hourly cron + manual dispatch.
- `docs/DESIGN_SPEC.md` — design principles, palette, typography, layout,
  component rules, what to bold vs. not.
- `docs/ENGINEERING_SPEC.md` — architecture, file contracts, deploy
  playbook, test checklist.
- `docs/WORK_SUMMARY_EN.md` / `docs/WORK_SUMMARY_ZH.md` — this report.
- `README.md` — developer-facing README (local dev, Scholar updates,
  editing content, deployment).

## Iteration log (condensed)

The page went through several directed revisions driven by the page
owner's running feedback:

1. **v1 — serif editorial layout.** Rejected: "not researcher-like."
2. **v2 — academic al-folio two-column.** Refined through several passes on
   emphasis, color, and emoji density.
3. **v3 — bilingual + live Scholar widget + gray monochrome.** The final
   direction: no colored badges, no italics, one font, one palette, real
   Scholar numbers, proper EN / 中 toggle.

Throughout, we tightened the bold-emphasis rule (only institutions the
reader needs to register + project names + role hooks + metric numbers),
removed Chinese characters from English copy, and replaced emoji contact
icons with real brand SVGs in a 3-column grid.

## Known follow-ups

- The Scholar scraper runs in GitHub's datacenter IP range, which Scholar
  rate-limits aggressively. If the free-proxy rotation fails in a given
  window, the data simply carries over — design-spec mandates that no
  failure ever surfaces as a zeroed number.
- The page is static: to add a new paper / news item / experience row,
  edit `index.html` and push.
