---
title: "How This Website Works: Hugo + GitHub Actions + Cloudflare Architecture"
date: 2025-11-28T00:00:00+00:00
draft: false
tags: ["infrastructure", "Hugo", "GitHub Actions", "Cloudflare", "CI/CD", "automation"]
slug: "website-infrastructure"
---

This website is built using a modern static site architecture that combines Hugo, GitHub Actions, and Cloudflare to deliver fast, secure, and automated deployments. Here's how everything works together.

<!--more-->

## Tech Stack Overview

**Static Site Generator**: Hugo (Extended version)
**Source Control**: GitHub ([github.com/akaJedi/f12](https://github.com/akaJedi/f12))
**CI/CD**: GitHub Actions
**Hosting**: GitHub Pages
**CDN/DNS**: Cloudflare
**Domain**: [www.f12.biz](https://www.f12.biz)

## Architecture Diagram

```
┌─────────────────┐
│  Local Machine  │
│   (Hugo Dev)    │
└────────┬────────┘
         │ git push
         ▼
┌─────────────────┐
│ GitHub Repo     │
│   (main branch) │
└────────┬────────┘
         │ triggers
         ▼
┌─────────────────┐
│ GitHub Actions  │
│   - Build Hugo  │
│   - Minify      │
│   - Deploy      │
└────────┬────────┘
         │ publishes to
         ▼
┌─────────────────┐
│ GitHub Pages    │
│  (gh-pages)     │
└────────┬────────┘
         │ served via
         ▼
┌─────────────────┐
│   Cloudflare    │
│  CDN + DNS      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  www.f12.biz    │
│   (visitors)    │
└─────────────────┘
```

The contact form and website chat are the dynamic parts of the site. They call a Cloudflare Worker, which persists chat leads in D1 and exchanges owner messages through the Telegram Bot API.

```
┌─────────────────┐
│ Contact Form    │
│  www.f12.biz    │
└────────┬────────┘
         │ POST JSON
         ▼
┌─────────────────┐
│ Cloudflare      │
│ Worker          │
└────────┬────────┘
         │ Telegram Bot API
         ▼
┌─────────────────┐
│ Telegram Chat   │
└─────────────────┘
```

## Deployment Workflow

### 1. Local Development

I develop and preview the site locally using Hugo's built-in server:

```bash
hugo server
```

This runs a live-reloading dev server at `http://localhost:1313`

### 2. Git Push to Main Branch

When I'm ready to publish changes, I commit and push to the `main` branch:

```bash
git add .
git commit -m "Add new blog post"
git push origin main
```

### 3. GitHub Actions Automation

The push triggers a GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy Hugo site to GitHub Pages

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout source
        uses: actions/checkout@v4

      - name: Setup Hugo (Extended)
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: 'latest'
          extended: true

      - name: Build site
        run: hugo --minify

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
          publish_branch: gh-pages
```

**What happens here:**

1. Checks out the repository code
2. Installs Hugo Extended (required for SCSS processing)
3. Builds the site with `hugo --minify` (optimizes HTML/CSS/JS)
4. Deploys the generated `/public` folder to the `gh-pages` branch

### 4. GitHub Pages Hosting

The `gh-pages` branch contains the fully built static site. GitHub Pages serves these files automatically.

### 5. Cloudflare Layer

Cloudflare sits in front of GitHub Pages providing:

- **DNS Management**: Routes `www.f12.biz` to GitHub Pages
- **CDN**: Caches static assets globally for faster load times
- **SSL/TLS**: Provides HTTPS encryption
- **DDoS Protection**: Shields the site from attacks
- **Performance**: Minification, compression, and optimization

### Contact Form Worker

The contact and chat backends are intentionally kept separate from the static website. The Hugo site contains only the public Worker URL and frontend JavaScript. The Telegram credentials are stored in Cloudflare Worker secrets/variables, not in this public repository.

Required Cloudflare Worker configuration:

- `TELEGRAM_BOT_TOKEN`: Telegram bot token from BotFather
- `TELEGRAM_ADMIN_CHAT_ID`: destination Telegram chat id

Operational notes:

1. Create or rotate the bot token in BotFather.
2. Open the bot in Telegram and send `/start` before testing.
3. Use `https://api.telegram.org/bot<token>/getUpdates` to verify the chat id.
4. Store the values in Cloudflare Worker settings as secrets/variables.
5. Do not commit token values or chat ids to the public website repository.

If the Worker returns `401 Unauthorized`, the bot token is invalid or missing. If it returns `400 Bad Request: chat not found`, the token works but the bot cannot access the configured chat yet.

### Contact Form Health Check

A scheduled GitHub Actions workflow (`.github/workflows/contact-form-healthcheck.yml`) sends a test payload to the production Worker once per day. This is an end-to-end production check: it verifies the Worker URL, CORS handling, Telegram token, chat id, and Telegram delivery path.

The workflow does not store Telegram secrets. It uses only the public Worker URL and a harmless test message. A successful run requires an HTTP `200` response with `{"success": true}`.

## Resume Automation Workflow

I also have a secondary workflow (`.github/workflows/update-resumes.yml`) that automatically updates resume metadata:

```yaml
name: Update Resume Metadata

on:
  push:
    paths:
      - "static/DenisTolochko_*"
    branches:
      - main
  workflow_dispatch:

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Run Bash generator
        run: bash scripts/resume-list-generator.sh

      - name: Enrich with VirusTotal
        run: python scripts/vt_update.py
        env:
          VT_API_KEY: ${{ secrets.VT_API_KEY }}

      - name: Commit changes
        run: |
          git add data/resumes.yaml
          git commit -m "Update resumes.yaml with VT links"
          git push
```

**What this does:**

1. Triggers when resume files are updated
2. Generates resume metadata
3. Enriches with VirusTotal scan links for security verification
4. Commits the updated `data/resumes.yaml` back to the repo

## Hugo Configuration

The site uses Hugo modules to load the theme:

```toml
baseURL = "https://www.f12.biz"
relativeURLs = true
canonifyURLs = true

[module]
[[module.imports]]
path = "github.com/zetxek/adritian-free-hugo-theme"
```

## Benefits of This Architecture

**Fully Automated**: Push to main = instant deployment
**Version Controlled**: Every change is tracked in Git
**Fast**: Static files + CDN = millisecond load times
**Secure**: No server-side code, HTTPS by default
**Cost-Effective**: GitHub Pages is free, Cloudflare free tier is generous
**Scalable**: Can handle traffic spikes without breaking
**Developer-Friendly**: Edit in any text editor, preview locally

## Deployment Time

From `git push` to live site: **~1-2 minutes**

The entire build and deployment process is automated, tested, and reliable.

---

*This infrastructure represents years of iteration to find the right balance between simplicity, performance, and maintainability. Static sites with automated deployments are my preferred approach for content-focused websites.*

*No databases to maintain, no servers to patch, no security vulnerabilities to worry about. Just content, version control, and CI/CD.*
