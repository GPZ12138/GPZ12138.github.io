# Peizhong (Chill) Gao — Personal Homepage

**🌐 Live site:** https://gpz12138.github.io/
**🔐 Admin dashboard:** https://gpz12138.github.io/admin/ (password in `secrets/ADMIN_CREDENTIALS.md`)

[![Live site](https://img.shields.io/badge/live-gpz12138.github.io-222222?style=flat-square)](https://gpz12138.github.io/)
[![Scholar sync](https://img.shields.io/badge/scholar%20sync-every%206h-222222?style=flat-square)](./.github/workflows/update-scholar.yml)

A static, single-page academic homepage for **Peizhong (Chill) Gao** — LLM
post-training and agent researcher at **GIX Institute** (Tsinghua × UW), core
contributor to **Kimi-Researcher** and owner of the **Data Science capability** of
**Kimi K2 / K2 Thinking** at **Moonshot AI**, and incoming AI Research Scientist
Intern at **[REDACTED]** ([REDACTED] / [REDACTED], Summer 2026).

## Highlights

- **Monochrome academic design**, one font (Source Sans 3), one page, one purpose.
- **Bilingual** (English / 中文) toggle in the header. English is the canonical version.
- **Light / dark theme** toggle.
- **Live Google Scholar stats** (citations, h-index, i10, paper count, per-year
  chart) auto-refreshed every 6 hours by a GitHub Actions workflow that scrapes
  Scholar and commits `data/scholar.json` — the client then fetches that JSON on
  every page load, so the numbers you see are always the most recent snapshot.
- **No build step.** Plain HTML / CSS / vanilla JS. Deploy = `git push`.

## Project structure

```
.
├── index.html               single-page homepage (bilingual data attributes)
├── styles.css               monochrome styling
├── script.js                theme / language / scholar fetch / reveal
├── assets/
│   └── profile.jpg          headshot (from Google Scholar profile)
├── data/
│   └── scholar.json         last-synced Scholar snapshot (auto-updated)
├── scripts/
│   ├── fetch_scholar.py     scrapes Scholar with `scholarly`
│   └── requirements.txt
├── .github/workflows/
│   └── update-scholar.yml   cron: every 6 hours + manual dispatch
├── docs/
│   ├── DESIGN_SPEC.md       design spec (palette, typography, layout)
│   ├── ENGINEERING_SPEC.md  engineering spec (architecture, contracts)
│   ├── WORK_SUMMARY_EN.md   build log — English
│   └── WORK_SUMMARY_ZH.md   build log — 中文
└── README.md
```

## Local development

```bash
# Any static server works — GitHub Pages serves exactly these files.
python3 -m http.server 8080
# http://localhost:8080
```

## Updating the Scholar data

The GitHub Actions workflow runs **every 6 hours** on `cron`, fetches the
latest citation stats from Google Scholar, diffs against
`data/scholar.json`, and commits + pushes on change.

You can also trigger it manually:

- GitHub UI → **Actions** → **Update Scholar Data** → **Run workflow**, or
- `gh workflow run update-scholar.yml`

If Scholar ever rate-limits the runner, the script preserves the last known
values and only updates the `last_updated` timestamp — so the client never
sees stale-looking zeros.

## Deployment

`main` branch is served directly by GitHub Pages (no Jekyll build required —
a `.nojekyll` sentinel file is included).

```bash
git push origin main
# Pages URL: https://gpz12138.github.io/
```

## Editing content

Every translatable string in `index.html` carries `data-en` and `data-zh`
attributes. `script.js` swaps them when the **EN / 中** toggle is pressed. To
add a new translatable line:

```html
<p data-en="Hello" data-zh="你好">Hello</p>
```

For strings that contain HTML (links, bold), add `data-en-html="true"`:

```html
<p data-en-html="true" data-en='Visit <a href="...">arXiv</a>.' data-zh='访问 <a href="...">arXiv</a>。'></p>
```

## License

Content © 2026 Peizhong (Chill) Gao. Code is MIT-licensed (see `LICENSE`).
