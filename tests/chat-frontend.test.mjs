import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFile(path.join(root, name), "utf8");

test("chat widget is mounted once by both shared Hugo templates", async () => {
  const [base, home, partial] = await Promise.all([
    read("layouts/_default/baseof.html"),
    read("layouts/_default/home.html"),
    read("layouts/partials/chat-widget.html"),
  ]);
  assert.equal(base.split('partial "chat-widget.html"').length - 1, 1);
  assert.equal(home.split('partial "chat-widget.html"').length - 1, 1);
  assert.match(partial, /data-chat-widget/);
  assert.match(partial, /data-chat-panel/);
  assert.match(partial, /role="dialog"/);
  assert.match(partial, /aria-live="polite"/);
  assert.match(partial, /data-chat-start-form/);
  assert.match(partial, /data-chat-turnstile/);
  assert.match(partial, /data-turnstile-site-key/);
  assert.match(partial, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(partial, /1x00000000000000000000AA/);
  assert.match(partial, /data-chat-draft-status/);
  assert.match(partial, /data-chat-callback-form/);
  assert.match(partial, /data-chat-followup-form/);
  assert.match(partial, /data-chat-closed-actions/);
  assert.match(partial, /data-chat-rail-tools/);
  assert.match(partial, /data-chat-new/);
  assert.match(partial, /Start a new conversation/);
  assert.match(partial, /hugo\.IsServer/);
  assert.match(partial, /devAssetVersion/);
  assert.match(partial, /data-chat-devbar/);
  assert.match(partial, /data-dev-indicator="telegram"/);
  assert.match(partial, /data-dev-refresh/);
  assert.equal((partial.match(/<button class="chat-devbar__item"/g) || []).length, 5);
  assert.match(partial, /data-dev-help-panel/);
  assert.match(partial, /aria-controls="chat-devbar-help"/);
  assert.match(partial, /npm run dev:worker/);
  assert.match(partial, /I agree to be contacted regarding this request/);
  assert.match(partial, /Я согласен\(-на\)/);
  assert.match(await read("content/privacy.md"), /Do not submit passwords, access keys, Social Security numbers/);
  assert.match(partial, /site-chat__doc-link/);
  assert.match(await read("content/privacy.md"), /hashed network identifier/);
  assert.match(await read("content/privacy.ru.md"), /хешированный сетевой идентификатор/);
  assert.doesNotMatch(partial, /verified by Cloudflare/i);
});

test("Contact routes and links use the persistent chat sidebar", async () => {
  const [contact, partial, script, english, russian] = await Promise.all([
    read("layouts/_default/contact.html"),
    read("layouts/partials/chat-widget.html"),
    read("static/js/chat-widget.js"),
    read("content/contact.md"),
    read("content/contact.ru.md"),
  ]);
  assert.match(contact, /data-chat-contact-page/);
  assert.match(contact, /data-chat-contact-open/);
  assert.match(contact, /Let’s talk\./);
  assert.match(contact, /Давайте поговорим\./);
  assert.doesNotMatch(contact, /contact-page__fallback|contact-page__channels|\{\{ \.Content \}\}/);
  assert.doesNotMatch(english + russian, /contact-section/);
  assert.match(partial, /site-chat__channels/);
  assert.match(partial, /f12\.setmore\.com/);
  assert.match(partial, /keybase\.io\/akajedi/);
  assert.match(partial, /pgp-key/);
  assert.match(script, /contactPaths = new Set\(\["\/contact", "\/ru\/contact"\]\)/);
  assert.match(script, /document\.querySelectorAll\("a\[href\]"\)/);
  assert.match(script, /requestAnimationFrame\(openPanel\)/);
});

test("chat client keeps only the session token locally and renders untrusted text safely", async () => {
  const script = await read("static/js/chat-widget.js");
  assert.match(script, /f12\.websiteChat\.sessionToken/);
  assert.equal((script.match(/localStorage\.setItem/g) || []).length, 1);
  assert.doesNotMatch(script, /localStorage\.setItem\([^,]*(name|email|phone|message)/i);
  assert.match(script, /body\.textContent = message\.messageText/);
  assert.match(script, /\/api\/chat\/draft/);
  assert.match(script, /function scheduleDraftSave\(\)/);
  assert.doesNotMatch(script, /sessionStorage/);
  assert.doesNotMatch(script, /innerHTML|insertAdjacentHTML|document\.write/);
  assert.match(script, /Authorization: `Bearer \$\{sessionToken\}`/);
  assert.match(script, /"X-Conversation-ID": conversationId/);
});

test("polling uses visibility-aware intervals, cursors, and recovery backoff", async () => {
  const script = await read("static/js/chat-widget.js");
  assert.match(script, /OPEN_INTERVAL = 3000/);
  assert.match(script, /MINIMIZED_INTERVAL = 15000/);
  assert.match(script, /MAX_BACKOFF = 60000/);
  assert.match(script, /if \(document\.hidden/);
  assert.match(script, /visibilitychange/);
  assert.match(script, /schedulePoll\(0\)/);
  assert.match(script, /messages\?after=\$\{cursor\}/);
  assert.match(script, /backoff \* 2/);
  assert.match(script, /Math\.random\(\) \* 500/);
  assert.match(script, /backoff = OPEN_INTERVAL/);
  assert.match(script, /\/api\/chat\/dev-status/);
  assert.match(script, /data-dev-indicator/);
  assert.match(script, /Page hidden; polling paused/);
  assert.match(script, /function resetConversation\(\)/);
  assert.match(script, /statusNode\.dataset\.state === "error"/);
  assert.match(script, /function openPanel\(\)[\s\S]*refreshAvailability\(\)/);
  assert.match(script, /messagesNode\.replaceChildren\(\)/);
  assert.match(script, /showClosedConversation\(result\.status === "closed"\)/);
  assert.match(script, /function toggleDevHelp\(indicator\)/);
  assert.match(script, /site-chat--conversation/);
  assert.match(script, /railTools\.append\(devbar\)/);
  assert.match(script, /data-chat-contact-open/);
  assert.match(script, /min-width: 992px/);
  assert.match(script, /Current status: /);
  assert.match(script, /aria-expanded/);
});

test("widget CSS retains accessible targets, focus, responsive layout, and reduced motion", async () => {
  const css = await read("static/css/chat-widget.css");
  assert.match(css, /min-height: 44px/);
  assert.match(css, /\.site-chat__turnstile \{[\s\S]*min-height: 65px/);
  assert.match(css, /\.site-chat__turnstile iframe \{ max-width: 100%; \}/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 575px\)/);
  assert.match(css, /100svh/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /var\(--summer-orange/);
  assert.match(css, /"Space Grotesk"/);
  assert.match(css, /\n\.chat-devbar \{/);
  assert.match(css, /\ chat-dev-pulse/);
  assert.match(css, /\ \(max-width: 900px\)/);
  assert.match(css, /data-state="error"/);
  assert.match(css, /chat-dev-pulse/);
  assert.match(css, /\.chat-devbar__help/);
  assert.match(css, /\ \(min-width: 992px\)/);
  assert.match(css, /\.site-chat--conversation\.is-open/);
  assert.match(css, /\.chat-devbar\.is-docked/);
  assert.match(css, /\.chat-devbar__refresh::before[\s\S]*width: 27px/);
  assert.match(css, /\.chat-devbar\.is-docked \.chat-devbar__refresh[\s\S]*min-width: 44px/);
  assert.match(css, /\.site-chat__channels a[\s\S]*min-height: 44px/);
  assert.match(css, /body:not\(\.page-contact\) \.site-chat__launcher/);
  assert.match(css, /site-chat-page-open body/);
  assert.match(css, /\ site-chat-rail-enter/);
  assert.match(css, /\.chat-devbar__item:focus-visible/);
  assert.match(css, /\.site-chat__accountability summary:focus-visible/);
});

test("homepage hero explains both operational value and openness to opportunities", async () => {
  const [english, russian, css] = await Promise.all([
    read("content/home/home.md"),
    read("content/home/home.ru.md"),
    read("assets/css/custom.css"),
  ]);
  assert.match(english, /summer-hero__context/);
  assert.match(english, /operations, security, and delivery/);
  assert.match(english, /open to new opportunities/);
  assert.match(russian, /эксплуатации, безопасности и доставки изменений/);
  assert.match(russian, /открыт новым возможностям/);
  assert.match(css, /body\.home \.summer-hero \{[\s\S]*max-width: 1180px[\s\S]*width: calc\(100% - 3rem\)/);
  assert.match(css, /body\.home \.header > \.container \{[\s\S]*max-width: 1180px[\s\S]*width: calc\(100% - 3rem\)/);
});

test("frontend files contain no configured secrets", async () => {
  const sources = await Promise.all([
    read("layouts/partials/chat-widget.html"),
    read("static/js/chat-widget.js"),
    read("static/css/chat-widget.css"),
  ]);
  const combined = sources.join("\n");
  for (const secret of [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_ADMIN_CHAT_ID",
    "TELEGRAM_WEBHOOK_SECRET",
    "SESSION_HASH_SECRET",
  ]) {
    assert.doesNotMatch(combined, new RegExp(secret));
  }
});

test("legacy contact form retains its endpoint contract and now sends the honeypot", async () => {
  const contact = await read("layouts/partials/contact.html");
  assert.match(contact, /class="contact__form"/);
  assert.match(contact, /name="secret_field"/);
  assert.match(contact, /secret_field: honeypotInput/);
  assert.match(contact, /fetch\(form\.action/);
});
