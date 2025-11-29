---
title: "Как работает этот сайт: Архитектура Hugo + GitHub Actions + Cloudflare"
date: 2025-11-28T00:00:00+00:00
draft: false
tags: ["инфраструктура", "Hugo", "GitHub Actions", "Cloudflare", "CI/CD", "автоматизация"]
slug: "website-infrastructure"
---

Этот сайт построен на современной архитектуре статического сайта, которая объединяет Hugo, GitHub Actions и Cloudflare для обеспечения быстрых, безопасных и автоматизированных развёртываний. Вот как всё работает вместе.

<!--more-->

## Обзор технологического стека

**Генератор статических сайтов**: Hugo (Extended версия)
**Система контроля версий**: GitHub ([github.com/akaJedi/f12](https://github.com/akaJedi/f12))
**CI/CD**: GitHub Actions
**Хостинг**: GitHub Pages
**CDN/DNS**: Cloudflare
**Домен**: [www.f12.biz](https://www.f12.biz)

## Диаграмма архитектуры

```
┌─────────────────┐
│ Локальная       │
│  машина         │
│   (Hugo Dev)    │
└────────┬────────┘
         │ git push
         ▼
┌─────────────────┐
│ GitHub Repo     │
│   (main ветка)  │
└────────┬────────┘
         │ запускает
         ▼
┌─────────────────┐
│ GitHub Actions  │
│   - Сборка Hugo │
│   - Минификация │
│   - Развёртыван.│
└────────┬────────┘
         │ публикует в
         ▼
┌─────────────────┐
│ GitHub Pages    │
│  (gh-pages)     │
└────────┬────────┘
         │ обслуживается через
         ▼
┌─────────────────┐
│   Cloudflare    │
│  CDN + DNS      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  www.f12.biz    │
│ (посетители)    │
└─────────────────┘
```

## Процесс развёртывания

### 1. Локальная разработка

Я разрабатываю и просматриваю сайт локально, используя встроенный сервер Hugo:

```bash
hugo server
```

Это запускает сервер с живой перезагрузкой на `http://localhost:1313`

### 2. Git Push в основную ветку

Когда я готов опубликовать изменения, я коммичу и пушу в ветку `main`:

```bash
git add .
git commit -m "Добавить новую статью в блог"
git push origin main
```

### 3. Автоматизация GitHub Actions

Push запускает workflow GitHub Actions (`.github/workflows/deploy.yml`):

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

**Что здесь происходит:**

1. Проверка кода репозитория
2. Установка Hugo Extended (требуется для обработки SCSS)
3. Сборка сайта с `hugo --minify` (оптимизирует HTML/CSS/JS)
4. Развёртывание сгенерированной папки `/public` в ветку `gh-pages`

### 4. Хостинг GitHub Pages

Ветка `gh-pages` содержит полностью собранный статический сайт. GitHub Pages автоматически обслуживает эти файлы.

### 5. Слой Cloudflare

Cloudflare располагается перед GitHub Pages, предоставляя:

- **Управление DNS**: Направляет `www.f12.biz` на GitHub Pages
- **CDN**: Кэширует статические ресурсы глобально для более быстрой загрузки
- **SSL/TLS**: Обеспечивает HTTPS-шифрование
- **Защита от DDoS**: Защищает сайт от атак
- **Производительность**: Минификация, сжатие и оптимизация

## Workflow автоматизации резюме

У меня также есть вторичный workflow (`.github/workflows/update-resumes.yml`), который автоматически обновляет метаданные резюме:

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

**Что это делает:**

1. Запускается при обновлении файлов резюме
2. Генерирует метаданные резюме
3. Обогащает ссылками на сканирование VirusTotal для проверки безопасности
4. Коммитит обновлённый `data/resumes.yaml` обратно в репозиторий

## Конфигурация Hugo

Сайт использует модули Hugo для загрузки темы:

```toml
baseURL = "https://www.f12.biz"
relativeURLs = true
canonifyURLs = true

[module]
[[module.imports]]
path = "github.com/zetxek/adritian-free-hugo-theme"
```

## Преимущества этой архитектуры

**Полная автоматизация**: Push в main = мгновенное развёртывание
**Контроль версий**: Каждое изменение отслеживается в Git
**Быстрота**: Статические файлы + CDN = загрузка за миллисекунды
**Безопасность**: Нет серверного кода, HTTPS по умолчанию
**Экономичность**: GitHub Pages бесплатен, бесплатный тариф Cloudflare щедрый
**Масштабируемость**: Выдерживает всплески трафика без сбоев
**Удобство для разработчика**: Редактирование в любом текстовом редакторе, локальный предпросмотр

## Время развёртывания

От `git push` до живого сайта: **~1-2 минуты**

Весь процесс сборки и развёртывания автоматизирован, протестирован и надёжен.

---

*Эта инфраструктура представляет собой годы итераций для нахождения правильного баланса между простотой, производительностью и сопровождаемостью. Статические сайты с автоматизированными развёртываниями — мой предпочтительный подход для контент-ориентированных веб-сайтов.*

*Нет баз данных для обслуживания, нет серверов для патчинга, нет уязвимостей безопасности, о которых нужно беспокоиться. Только контент, контроль версий и CI/CD.*
