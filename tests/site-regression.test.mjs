import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, before, test } from "node:test";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".test-public");
const cache = path.join(root, ".test-cache");
const analyticsId = "G-LPLDLSPHQL";

const readSource = (relativePath) =>
  readFile(path.join(root, relativePath), "utf8");

const readBuilt = (relativePath) =>
  readFile(path.join(output, relativePath), "utf8");

const occurrences = (text, needle) => text.split(needle).length - 1;

before(async () => {
  await Promise.all([
    rm(output, { recursive: true, force: true }),
    rm(cache, { recursive: true, force: true }),
  ]);

  const build = spawnSync(
    "hugo",
    [
      "--gc",
      "--minify",
      "--environment",
      "production",
      "--cacheDir",
      cache,
      "--destination",
      output,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, HUGO_ENVIRONMENT: "production" },
    },
  );

  assert.equal(
    build.status,
    0,
    ["Hugo production build failed.", build.stdout, build.stderr]
      .filter(Boolean)
      .join("\n"),
  );
});

after(async () => {
  await Promise.all([
    rm(output, { recursive: true, force: true }),
    rm(cache, { recursive: true, force: true }),
  ]);
});

test("Hugo generates the site's core routes", async () => {
  const routes = [
    "index.html",
    "404.html",
    "contact/index.html",
    "skills/index.html",
    "search/index.html",
    "blog/yurga-station/index.html",
    "blog/page/2/index.html",
    "index.json",
  ];

  for (const route of routes) {
    const details = await stat(path.join(output, route));
    assert.ok(details.isFile(), route + " should be a generated file");
    assert.ok(details.size > 100, route + " should not be empty");
  }
});

test("production builds exclude the localhost status taskbar", async () => {
  const html = await readBuilt("index.html");
  assert.doesNotMatch(html, /data-chat-devbar/);
  assert.doesNotMatch(html, /Local link/);
  assert.doesNotMatch(html, /host-environment-banner/);
});

test("rendered homepages never leak shortcode syntax or corrupted Unicode", async () => {
  for (const page of ["index.html", "ru/index.html"]) {
    const html = await readBuilt(page);
    assert.doesNotMatch(html, /\{\{[<%]/, page + " leaked Hugo shortcode syntax");
    assert.doesNotMatch(html, /�/, page + " contains a Unicode replacement character");
  }
});

test("every core page contains exactly one Google Analytics tag", async () => {
  const pages = [
    "index.html",
    "404.html",
    "contact/index.html",
    "skills/index.html",
    "search/index.html",
    "blog/yurga-station/index.html",
  ];

  for (const page of pages) {
    const html = await readBuilt(page);
    assert.equal(
      occurrences(html, "googletagmanager.com/gtag/js?id=" + analyticsId),
      1,
      page + " must load GA exactly once",
    );
    assert.equal(
      occurrences(html, 'gtag("config","' + analyticsId + '")'),
      1,
      page + " must configure GA exactly once",
    );
  }
});

test("search index is populated, unique, and includes useful previews", async () => {
  const entries = JSON.parse(await readBuilt("index.json"));
  assert.ok(entries.length > 50, "search index unexpectedly contains too few pages");

  const links = entries.map((entry) => entry.link);
  assert.equal(new Set(links).size, links.length, "search index contains duplicate URLs");

  const station = entries.find((entry) => entry.link === "/blog/yurga-station/");
  assert.ok(station, "Yurga station article is missing from search");
  assert.match(station.contents, /Yurga station opened in 1906/i);
  assert.ok(station.summary.length > 40, "search preview should contain useful text");

  const template = await readSource("layouts/_default/index.json");
  assert.match(template, /Scratch\.Set "index" slice/);
  assert.match(template, /RawContent \| markdownify \| plainify/);
});

test("search client uses the language-aware index and deduplicates results", async () => {
  const [script, template] = await Promise.all([
    readSource("static/js/search.js"),
    readSource("layouts/_default/search.html"),
  ]);

  assert.match(script, /dataset\.searchIndex/);
  assert.match(script, /new Map\(/);
  assert.match(script, /buildSnippet\(item\)/);
  assert.doesNotMatch(script, /No preview available/);
  assert.match(template, /data-search-index=/);
});

test("contact route uses the persistent sidebar as its only message form", async () => {
  const html = await readBuilt("contact/index.html");

  assert.equal((html.match(/class=contact__form/g) || []).length, 0, "legacy contact form must not render");
  assert.equal((html.match(/data-chat-start-form/g) || []).length, 1, "chat start form must render once");
  assert.match(html, /data-chat-contact-page/);
  assert.match(html, /data-chat-contact-open/);
  assert.match(html, /class=site-chat__channels/);
  assert.match(html, /f12\.setmore\.com/);
  assert.match(html, /keybase\.io\/akajedi/);
  assert.match(html, /pgp-key/);
  assert.doesNotMatch(html, /contact-page__fallback/);
});

test("skills percentages match their bars and experience stays visible", async () => {
  const html = await readBuilt("skills/index.html");

  const displayed = Array.from(
    html.matchAll(/class=skill-range[^>]*>(\d+) \/ 100</g),
    (match) => Number(match[1]),
  );
  const bars = Array.from(
    html.matchAll(/role=progressbar[^>]*aria-valuenow=(\d+)/g),
    (match) => Number(match[1]),
  );

  assert.ok(
    displayed.length >= 20,
    "skills page unexpectedly contains too few proficiency values",
  );
  assert.deepEqual(
    displayed,
    bars,
    "displayed skill values must match their progress bars",
  );
  assert.doesNotMatch(html, />0 \/ 100</);

  const years = Array.from(
    html.matchAll(/class=skill-years[^>]*>[\s\S]*?<strong>(\d+\+)<\/strong>\s*<span>years<\/span>/g),
    (match) => match[1],
  );
  assert.equal(years.length, displayed.length, "every skill must show experience years");
  assert.ok(years.every((value) => /^\d+\+$/.test(value)), "experience must be numeric");
});

test("shared grid, responsive layout, and transparent fields stay intact", async () => {
  const css = await readSource("assets/css/custom.css");

  assert.match(css, /body,\s*body\.home\s*\{[\s\S]*background-size:\s*52px 52px/);
  assert.match(css, /@media \(max-width:\s*575px\)[\s\S]*background-size:\s*44px 44px/);
  assert.match(css, /contact__form input,[\s\S]*background:\s*transparent !important/);
  assert.match(css, /contact__form input,[\s\S]*color:\s*var\(--summer-ink\) !important/);
  assert.match(css, /@media \(max-width:\s*767px\)/);
  assert.match(css, /body\.home \.summer-hero \{[\s\S]*max-width: 1180px[\s\S]*width: calc\(100% - 3rem\)/);
  assert.match(css, /body\.home \.header > \.container \{[\s\S]*max-width: 1180px[\s\S]*width: calc\(100% - 3rem\)/);
  assert.match(css, /@media \(max-width:\s*575px\)[\s\S]*\.summer-signal\s*\{[\s\S]*min-height:\s*100svh/);
  assert.doesNotMatch(css, /preferences-unlocked|summer-signal__quarter|summer-signal__ring--two/);
});

test("homepage mini slideshow keeps its ten-second interval and controls", async () => {
  const [script, html] = await Promise.all([
    readSource("static/js/signal-carousel.js"),
    readBuilt("index.html"),
  ]);

  assert.match(script, /dataset\.interval\) \|\| 10000/);
  assert.match(script, /prefers-reduced-motion:\s*reduce/);
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /querySelectorAll\("\[data-signal-pads\]"\)/);
  assert.match(script, /querySelectorAll\("\[data-signal-wheel\]"\)/);
  assert.match(script, /orbit\.playbackRate/);
  assert.doesNotMatch(script, /data-preference-ring|data-ring-action|data-ring-center|preferences-unlocked/);
  assert.doesNotMatch(script, /MediaRecorder|data-signal-recorder/);
  assert.match(html, /data-signal-carousel/);
  assert.match(html, /data-interval=10000/);
  assert.equal(occurrences(html, "data-signal-slide"), 6);
  assert.match(html, /Reliable systems/);
  assert.match(html, /Remove toil/);
  assert.match(html, /Least privilege/);
  assert.match(html, /Clear handoffs/);
  assert.doesNotMatch(html, /15\+ years/);
  assert.match(html, /data-signal-pads/);
  assert.match(html, /data-signal-wheel/);
  assert.doesNotMatch(html, /data-signal-recorder|data-record-download/);
  assert.doesNotMatch(html, /data-preference-ring|data-ring-action|summer-signal__quarter/);
  assert.doesNotMatch(html, /summer-signal__shortcut-guide|RING SHORTCUTS/);
  assert.doesNotMatch(html, /localStorage\.getItem\("preferences-unlocked"\)/);
  assert.match(html, /signal-carousel\.js/);

  const padGrid = html.match(/data-signal-pads[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(padGrid, "performance pad grid is missing");
  assert.equal(
    occurrences(padGrid[1], "<span"),
    12,
    "performance grid must retain twelve sound pads",
  );
});

test("only tile four plays the supplied coffee track and tiles stay hidden on mobile", async () => {
  const [script, css, html, audio] = await Promise.all([
    readSource("static/js/signal-carousel.js"),
    readSource("assets/css/custom.css"),
    readBuilt("index.html"),
    stat(path.join(output, "audio/sound-04.mp3")),
  ]);

  assert.match(script, /classList\.add\("is-hit"\)/);
  assert.match(script, /if \(index === 3\)[\s\S]*playCoffeeTrack\(\)/);
  assert.match(script, /new Audio\("\/audio\/sound-04\.mp3"\)/);
  assert.match(script, /coffeeTrack\.play\(\)/);
  assert.match(script, /classList\.add\("is-coffee-active"\)/);
  assert.doesNotMatch(script, /autoplay|AudioContext|playPadSound|signal-sound-set/);
  assert.ok(audio.isFile());
  assert.ok(audio.size > 1000, "coffee track must not be empty");
  assert.match(html, /data-signal-pads/);
  assert.doesNotMatch(html, /data-signal-sets|data-signal-set=/);
  assert.match(css, /Visual-only signal panel:[\s\S]*summer-signal__grid\[data-signal-pads\][\s\S]*display: none !important/);
  assert.match(css, /span:nth-child\(4\):hover[\s\S]*linear-gradient\(145deg, #a87958, #5d3b29\)/);
});

test("blog introduction appears only on page one and collapses on mobile", async () => {
  const [firstPage, secondPage, russianPage, css] = await Promise.all([
    readBuilt("blog/index.html"),
    readBuilt("blog/page/2/index.html"),
    readBuilt("ru/blog/index.html"),
    readSource("assets/css/custom.css"),
  ]);

  assert.match(firstPage, /class=blog-archive__hero/);
  assert.doesNotMatch(secondPage, /class=blog-archive__hero/);
  assert.match(firstPage, /class=blog-archive__intro-toggle/);
  assert.match(russianPage, /Показать описание/);
  assert.match(css, /@media \(max-width:\s*575px\)[\s\S]*blog-archive__intro-toggle:not\(\[open\]\)[\s\S]*display:\s*none/);
});

test("language and theme controls are always visible, not gated behind a hidden trigger", async () => {
  const [partial, script, css, english, russian] = await Promise.all([
    readSource("layouts/partials/site-controls.html"),
    readSource("static/js/site-controls.js"),
    readSource("assets/css/custom.css"),
    readBuilt("index.html"),
    readBuilt("ru/index.html"),
  ]);

  assert.match(partial, /site-controls__lang/);
  assert.match(partial, /data-theme-toggle/);
  assert.doesNotMatch(partial, /dropdown-toggle|data-bs-toggle="dropdown"/);

  assert.match(script, /data-bs-theme", next\)/);
  assert.match(script, /localStorage\.setItem\(STORAGE_KEY, next\)/);
  assert.match(script, /prefers-color-scheme: dark/);

  assert.doesNotMatch(css, /\.site-controls[\s\S]{0,400}display:\s*none !important/);
  assert.match(css, /\.site-controls__lang,\s*\n\.site-controls__theme\s*\{/);

  assert.match(english, /class=site-controls/);
  assert.match(english, /data-theme-toggle/);
  assert.match(english, /class=site-controls__lang href=\.\/ru\/[^>]*>RU<\/a>/);
  assert.match(russian, /class=site-controls__lang href=\.\.\/[^>]*>EN<\/a>/);

  assert.doesNotMatch(english + russian, /data-preference-ring|preferences-unlocked|dropdown language-selector|dropdown theme-selector/);
});
