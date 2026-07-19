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

Форма обратной связи и чат — динамические части сайта. Они обращаются к Cloudflare Worker, который сохраняет обращения чата в D1 и обменивается сообщениями владельца через Telegram Bot API.

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

### Worker формы обратной связи

Бэкенд формы и чата намеренно отделён от статического сайта. Hugo-сайт содержит только публичный URL Worker и клиентский JavaScript. Учётные данные Telegram хранятся в секретах/переменных Cloudflare Worker, а не в этом публичном репозитории.

Необходимая конфигурация Cloudflare Worker:

- `TELEGRAM_BOT_TOKEN`: токен Telegram-бота из BotFather
- `TELEGRAM_ADMIN_CHAT_ID`: id Telegram-чата назначения

Операционные заметки:

1. Создать или заменить токен бота в BotFather.
2. Открыть бота в Telegram и отправить `/start` перед тестированием.
3. Проверить chat id через `https://api.telegram.org/bot<token>/getUpdates`.
4. Сохранить значения в настройках Cloudflare Worker как секреты/переменные.
5. Не коммитить значения токенов или chat id в публичный репозиторий сайта.

Если Worker возвращает `401 Unauthorized`, токен бота неверный или отсутствует. Если он возвращает `400 Bad Request: chat not found`, токен работает, но бот пока не имеет доступа к указанному чату.

### Health check формы обратной связи

Запланированный GitHub Actions workflow (`.github/workflows/contact-form-healthcheck.yml`) раз в день отправляет тестовый payload в production Worker. Это end-to-end проверка production-цепочки: URL Worker, CORS, Telegram token, chat id и путь доставки в Telegram.

Workflow не хранит Telegram-секреты. Он использует только публичный URL Worker и безопасное тестовое сообщение. Успешный запуск требует HTTP `200` и ответа `{"success": true}`.

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
