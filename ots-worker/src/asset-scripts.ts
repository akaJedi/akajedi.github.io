const shared = String.raw`
const q = (selector) => document.querySelector(selector);
const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 600000;
function b64(bytes) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function unb64(value) {
  value = value.replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(value + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
function message(node, value, error = false) {
  node.textContent = value;
  node.dataset.error = String(error);
}
async function copy(value, button) {
  await navigator.clipboard.writeText(value);
  button.textContent = "Copied";
  setTimeout(() => button.textContent = "Copy", 1500);
}
async function passwordKey(password, salt, usage) {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}
`;

const createScript = shared + String.raw`
q("#use-password").addEventListener("change", (event) => {
  const enabled = event.target.checked;
  q("#password-fields").hidden = !enabled;
  q("#create-password").required = enabled;
  q("#confirm-password").required = enabled;
});

q("#create-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const status = q("#create-status");
  button.disabled = true;
  message(status, "Encrypting locally…");
  try {
    const plaintext = q("#secret").value;
    const passwordProtected = q("#use-password").checked;
    const password = q("#create-password").value;
    if (!plaintext) throw Error("Enter a secret first.");
    if (passwordProtected && password.length < 12) throw Error("Use at least 12 password characters.");
    if (passwordProtected && password !== q("#confirm-password").value) throw Error("Passwords do not match.");

    const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", contentKey));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, contentKey, enc.encode(plaintext)));
    const request = await fetch("/api/owner/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext: b64(ciphertext), iv: b64(iv), expiresIn: Number(q("#expiry").value), passwordProtected }),
    });
    const body = await request.json();
    if (!request.ok) throw Error(body.error || "Creation failed.");

    let fragment;
    if (passwordProtected) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const wrapIv = crypto.getRandomValues(new Uint8Array(12));
      const wrappingKey = await passwordKey(password, salt, "encrypt");
      const wrappedKey = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: wrapIv }, wrappingKey, rawKey));
      fragment = ["v2", body.id, body.claimToken, b64(salt), b64(wrapIv), b64(wrappedKey)].join(".");
    } else {
      fragment = ["v1", body.id, body.claimToken, b64(rawKey)].join(".");
    }
    q("#share-url").value = location.origin + "/#" + fragment;
    q("#create-result").hidden = false;
    q("#secret").value = "";
    q("#create-password").value = "";
    q("#confirm-password").value = "";
    message(status, "Link created. Plaintext and password cleared.");
  } catch (error) {
    message(status, error.message || "Creation failed.", true);
  } finally {
    button.disabled = false;
  }
});
q("#copy-link").addEventListener("click", () => copy(q("#share-url").value, q("#copy-link")));
`;

const revealScript = shared + String.raw`
function linkParts() {
  let match = location.hash.match(/^#v1[.]([A-Za-z0-9_-]{20,64})[.]([A-Za-z0-9_-]{40,64})[.]([A-Za-z0-9_-]{40,64})$/);
  if (match) return { version: 1, id: match[1], token: match[2], key: match[3] };
  match = location.hash.match(/^#v2[.]([A-Za-z0-9_-]{20,64})[.]([A-Za-z0-9_-]{40,64})[.]([A-Za-z0-9_-]{20,24})[.]([A-Za-z0-9_-]{16})[.]([A-Za-z0-9_-]{60,68})$/);
  return match && { version: 2, id: match[1], token: match[2], salt: match[3], wrapIv: match[4], wrappedKey: match[5] };
}

const link = linkParts();
if (link && link.version === 2) {
  q("#password-step").hidden = false;
  q("#reveal-button").textContent = "Unlock & reveal once";
}
if (!link) message(q("#reveal-status"), "Invalid link.", true);

q("#reveal-button").addEventListener("click", async () => {
  if (!link) return;
  const button = q("#reveal-button");
  const status = q("#reveal-status");
  button.disabled = true;
  try {
    let rawKey;
    if (link.version === 2) {
      const password = q("#reveal-password").value;
      if (!password) throw Error("Enter the separate password.");
      message(status, "Checking password locally…");
      try {
        const wrappingKey = await passwordKey(password, unb64(link.salt), "decrypt");
        rawKey = new Uint8Array(await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: unb64(link.wrapIv) },
          wrappingKey,
          unb64(link.wrappedKey),
        ));
      } catch {
        throw Error("Password is incorrect. The secret was not consumed.");
      }
    } else {
      rawKey = unb64(link.key);
    }

    message(status, "Deleting encrypted server copy…");
    const request = await fetch("/api/secrets/" + link.id + "/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimToken: link.token }),
    });
    const body = await request.json();
    if (!request.ok) throw Error(body.error || "Secret unavailable.");
    const contentKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
    const plaintext = dec.decode(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(body.iv) },
      contentKey,
      unb64(body.ciphertext),
    ));
    history.replaceState(null, "", location.pathname);
    q("#reveal-password").value = "";
    q("#revealed-secret").value = plaintext;
    q("#reveal-ready").hidden = true;
    q("#password-step").hidden = true;
    q("#revealed").hidden = false;
    message(status, "Revealed. Encrypted server copy deleted.");
  } catch (error) {
    message(status, error.message || "Reveal failed.", true);
    button.disabled = false;
  }
});
q("#copy-secret").addEventListener("click", () => copy(q("#revealed-secret").value, q("#copy-secret")));
`;

const ownerScript = String.raw`
const q = (selector) => document.querySelector(selector);
const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const date = (value) => new Date(value).toLocaleString();
function left(milliseconds) {
  if (milliseconds <= 0) return "now";
  const minutes = Math.ceil(milliseconds / 60000);
  if (minutes < 60) return minutes + " min";
  const hours = Math.ceil(minutes / 60);
  return hours < 48 ? hours + " hr" : Math.ceil(hours / 24) + " days";
}
function card(item, now) {
  const end = item.status === "active" ? item.expiresAt : item.removeAt;
  const label = item.status === "active" ? "expires in " : "receipt removed in ";
  return '<a class="link-card" href="/create/links/' + encodeURIComponent(item.id) + '"><span><strong>' + esc(item.fingerprint) + '</strong><br><small>Created ' + esc(date(item.createdAt)) + ' · ' + esc(item.sizeBytes) + ' encrypted bytes · ' + (item.passwordProtected ? "password protected" : "link protected") + '</small></span><span class="status ' + (item.status === "active" ? "" : "finished") + '">' + esc(item.status) + '<br><small>' + label + esc(left(end - now)) + "</small></span></a>";
}
function details(item, now) {
  const timer = item.status === "active"
    ? "<div><dt>Expires</dt><dd>" + esc(date(item.expiresAt)) + " (" + esc(left(item.expiresAt - now)) + ")</dd></div>"
    : "<div><dt>Receipt removed</dt><dd>" + esc(date(item.removeAt)) + " (" + esc(left(item.removeAt - now)) + ")</dd></div>";
  return "<dl><div><dt>Reference</dt><dd>" + esc(item.fingerprint) + "</dd></div><div><dt>Status</dt><dd>" + esc(item.status) + "</dd></div><div><dt>Created</dt><dd>" + esc(date(item.createdAt)) + "</dd></div>" + timer + "<div><dt>Encrypted size</dt><dd>" + esc(item.sizeBytes) + " bytes</dd></div><div><dt>Password</dt><dd>" + (item.passwordProtected ? "Required" : "Not required") + "</dd></div></dl>";
}
async function loadList() {
  const status = q("#links-status");
  try {
    const request = await fetch("/api/owner/secrets");
    const body = await request.json();
    if (!request.ok) throw Error(body.error || "Unable to load links.");
    const active = body.items.filter((item) => item.status === "active").length;
    q("#links-summary").textContent = active + " active · " + (body.items.length - active) + " recent";
    q("#links-list").innerHTML = body.items.length ? body.items.map((item) => card(item, body.now)).join("") : '<div class="empty">No active or recently finished links.</div>';
  } catch (error) {
    status.textContent = error.message;
    status.dataset.error = "true";
  }
}
async function loadDetail() {
  const root = q(".owner-detail");
  const id = root.dataset.secretId;
  const status = q("#detail-status");
  try {
    const request = await fetch("/api/owner/secrets/" + encodeURIComponent(id));
    const body = await request.json();
    if (!request.ok) throw Error(body.error || "Link metadata is no longer available.");
    q("#link-detail").innerHTML = details(body.item, body.now);
    q("#delete-panel").hidden = body.item.status !== "active";
    q("#delete-link").addEventListener("click", async () => {
      if (!confirm("Permanently delete this encrypted payload now?")) return;
      const removal = await fetch("/api/owner/secrets/" + encodeURIComponent(id), { method: "DELETE", headers: { "Content-Type": "application/json" } });
      const result = await removal.json();
      if (!removal.ok) throw Error(result.error || "Deletion failed.");
      location.reload();
    });
  } catch (error) {
    q("#link-detail").textContent = error.message;
    status.dataset.error = "true";
  }
}
q(".owner-list") ? loadList() : loadDetail();
`;

const homeScript = `if (location.hash) { document.querySelector("#home-view").hidden = true; document.querySelector("#reveal-view").hidden = false; ${revealScript} }`;

export { createScript, homeScript, ownerScript, revealScript };
