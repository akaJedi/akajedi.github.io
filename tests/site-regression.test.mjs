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
const workerURL = "https://green-rice-1ea7.denis-f21.workers.dev";

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
    "index.json",
  ];

  for (const route of routes) {
    const details = await stat(path.join(output, route));
    assert.ok(details.isFile(), route + " should be a generated file");
    assert.ok(details.size > 100, route + " should not be empty");
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

test("contact form remains accessible and wired to the Worker", async () => {
  const html = await readBuilt("contact/index.html");

  assert.equal(occurrences(html, "<form"), 1, "contact page must contain one form");
  assert.equal(occurrences(html, "contact__form"), 2, "form class and script hook changed");
  assert.ok(html.includes("action=" + workerURL), "contact form Worker URL changed");
  assert.match(html, /name=full_name[^>]*required/);
  assert.match(html, /name=email[^>]*required/);
  assert.match(html, /name=message[^>]*required/);
  assert.match(html, /role=status aria-live=polite/);

  for (const field of ["name", "email", "phone", "message"]) {
    assert.match(html, new RegExp("label for=contact-message-" + field));
    assert.match(html, new RegExp("id=contact-message-" + field));
  }
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

test("shared grid, responsive layout, theme menu, and transparent fields stay intact", async () => {
  const css = await readSource("assets/css/custom.css");

  assert.match(css, /body,\s*body\.home\s*\{[\s\S]*background-size:\s*52px 52px/);
  assert.match(css, /@media \(max-width:\s*575px\)[\s\S]*background-size:\s*44px 44px/);
  assert.match(css, /\.dropdown-menu\.show\s*\{\s*display:\s*block !important/);
  assert.match(css, /contact__form input,[\s\S]*background:\s*transparent !important/);
  assert.match(css, /contact__form input,[\s\S]*color:\s*var\(--summer-ink\) !important/);
  assert.match(css, /@media \(max-width:\s*767px\)/);
  assert.match(css, /\.header \.language-selector,[\s\S]*\.footer_right\s*\{\s*display:\s*none !important/);
  assert.match(css, /body\.home \.header > \.container \{[\s\S]*padding-inline: clamp\(1\.25rem, 5vw, 4rem\)/);
  assert.match(css, /@media \(min-width:\s*992px\)[\s\S]*html\.preferences-unlocked[\s\S]*display:\s*block !important/);
  assert.match(css, /@media \(max-width:\s*575px\)[\s\S]*\.summer-signal\s*\{[\s\S]*min-height:\s*100svh/);
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
  assert.match(script, /window\.AudioContext \|\| window\.webkitAudioContext/);
  assert.match(script, /querySelectorAll\("\[data-signal-wheel\]"\)/);
  assert.match(script, /orbit\.playbackRate/);
  assert.match(script, /unlockClicks === 3/);
  assert.match(script, /localStorage\.setItem\("preferences-unlocked", "true"\)/);
  assert.match(script, /localStorage\.removeItem\("preferences-unlocked"\)/);
  assert.doesNotMatch(script, /MediaRecorder|data-signal-recorder/);
  assert.match(html, /data-signal-carousel/);
  assert.match(html, /data-interval=10000/);
  assert.match(html, /data-signal-pads/);
  assert.match(html, /data-signal-wheel/);
  assert.match(html, /data-signal-sets/);
  assert.equal(occurrences(html, "data-signal-set="), 3);
  assert.doesNotMatch(html, /data-signal-recorder|data-record-download/);
  assert.match(html, /localStorage\.getItem\("preferences-unlocked"\)/);
  assert.match(html, /signal-carousel\.js/);

  const padGrid = html.match(/data-signal-pads[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(padGrid, "performance pad grid is missing");
  assert.equal(
    occurrences(padGrid[1], "<span"),
    12,
    "performance grid must retain twelve sound pads",
  );
});

test("DJ pads expose three stable twelve-sound sets with persistent switching", async () => {
  const [script, manifestSource, loopFiles, fallbackFiles, chillFiles] = await Promise.all([
    readSource("static/js/signal-carousel.js"),
    readSource("static/audio/loops/manifest.json"),
    readdir(path.join(root, "static", "audio", "loops")),
    readdir(path.join(root, "static", "audio", "dj-pads")),
    readdir(path.join(root, "static", "audio", "chill")),
  ]);
  const manifest = JSON.parse(manifestSource);
  const mp3Loops = loopFiles.filter((name) => name.endsWith(".mp3")).sort();
  const chillWavs = chillFiles.filter((name) => name.endsWith(".wav")).sort();

  assert.equal(manifest.length, 12, "the production setup must contain exactly twelve loops");
  assert.deepEqual(manifest, Array.from({ length: 12 }, (_, itemIndex) => "sequence-" + String(itemIndex + 1).padStart(2, "0") + ".mp3"));
  assert.equal(new Set(manifest).size, manifest.length, "loop manifest must be unique");
  assert.deepEqual(new Set(manifest), new Set(mp3Loops), "manifest must index every supplied MP3 loop");
  assert.equal(fallbackFiles.filter((name) => name.endsWith(".wav")).length, 12);
  assert.deepEqual(chillWavs, Array.from({ length: 12 }, (_, itemIndex) => "chill-" + String(itemIndex + 1).padStart(2, "0") + ".wav"));
  assert.match(script, /const soundSets = \[sequencePads, fallbackPads, chillPads\]/);
  assert.match(script, /localStorage\.getItem\("signal-sound-set"\)/);
  assert.match(script, /selectSoundSet\(Number\(button\.dataset\.signalSet\)\)/);
  assert.match(script, /const stopAllPads/);
  assert.match(script, /audio\.loop = assignment\.loop/);
  assert.match(script, /activeLoops\.get\(index\)/);
  assert.match(script, /playing\.pause\(\)/);
  assert.match(script, /\/audio\/dj-pads\//);
  assert.match(script, /playSynthFallback/);
  assert.match(script, /attack\.stop\(now \+ 0\.08\);\n  \};\n\n  const playPadSound/);
  assert.doesNotMatch(script, /playPadTone/);
  assert.doesNotMatch(script, /await padAssignments/);
  assert.match(script, /activeLoops\.set\(index, audio\);\n      await audio\.play\(\)/);

  const headers = await Promise.all(
    [...manifest.slice(0, 2), ...fallbackFiles.slice(0, 2)].map((name, index) =>
      readFile(path.join(
        root,
        "static",
        "audio",
        index < 2 ? "loops" : "dj-pads",
        name,
      ))),
  );
  headers.slice(0, 2).forEach((audio) => assert.ok(audio.length > 1000));
  headers.slice(2).forEach((audio) => assert.equal(audio.subarray(0, 4).toString(), "RIFF"));
  const chillHeaders = await Promise.all(chillWavs.slice(0, 2).map((name) =>
    readFile(path.join(root, "static", "audio", "chill", name))));
  chillHeaders.forEach((audio) => assert.equal(audio.subarray(0, 4).toString(), "RIFF"));
});

test("Worker CORS allows every supported site and rejects arbitrary origins", async () => {
  const source = await readSource("content/worker.js");
  const moduleURL =
    "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  const worker = (await import(moduleURL)).default;

  const allowed = [
    "http://localhost:1313",
    "http://127.0.0.1:1313",
    "https://www.f12.biz",
    "https://f12.biz",
    "https://cloudflare.f12.biz",
    "https://github.f12.biz",
  ];

  for (const origin of allowed) {
    const response = await worker.fetch(
      new Request(workerURL, {
        method: "OPTIONS",
        headers: { Origin: origin },
      }),
      {},
    );
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  }

  const response = await worker.fetch(
    new Request(workerURL, {
      method: "OPTIONS",
      headers: { Origin: "https://attacker.example" },
    }),
    {},
  );
  assert.notEqual(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://attacker.example",
  );
});

test("Worker validates submissions and sends the expected Telegram payload", async () => {
  const source = await readSource("content/worker.js");
  const moduleURL =
    "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  const worker = (await import(moduleURL)).default;

  const invalid = await worker.fetch(
    new Request(workerURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:1313",
      },
      body: JSON.stringify({ name: "", email: "", message: "" }),
    }),
    {},
  );
  assert.equal(invalid.status, 400);

  const originalFetch = globalThis.fetch;
  let telegramRequest;

  globalThis.fetch = async (url, options) => {
    telegramRequest = { url: String(url), options };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await worker.fetch(
      new Request(workerURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:1313",
          Referer: "http://localhost:1313/contact/",
        },
        body: JSON.stringify({
          name: "Regression Test",
          email: "tests@example.com",
          phone: "+1 555 0100",
          message: "No external message is sent.",
        }),
      }),
      {
        TELEGRAM_TOKEN: "fake-token",
        TELEGRAM_CHAT_ID: "fake-chat",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.equal(
      telegramRequest.url,
      "https://api.telegram.org/botfake-token/sendMessage",
    );

    const payload = JSON.parse(telegramRequest.options.body);
    assert.equal(payload.chat_id, "fake-chat");
    assert.match(payload.text, /Site: localhost:1313/);
    assert.match(payload.text, /Regression Test/);
    assert.match(payload.text, /tests@example\.com/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
