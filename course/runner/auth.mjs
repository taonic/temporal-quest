// Learners sign in with their email (accounts.mjs). Each user has a random id, signed into a
// cookie with the time they signed in. The id is what a sandbox is labeled with, so a learner
// can only ever reach their own sandbox, and the sandbox's model key is signed from it too; the
// email never leaves the runner's database.
import crypto from "node:crypto";

export const SESSION_COOKIE = "course_session";
// A session lasts 14 days from sign-in, without sliding.
export const SESSION_DAYS = 14;
const MAX_AGE_SECONDS = SESSION_DAYS * 24 * 3600;

function sign(secret, purpose, value) {
  return crypto.createHmac("sha256", secret).update(`${purpose}:${value}`).digest("base64url");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function newLearnerId() {
  return crypto.randomBytes(12).toString("base64url");
}

const LEARNER_ID = /^[A-Za-z0-9_-]{8,64}$/;

// `id.issuedAt.sig`, issuedAt in seconds. Ids and signatures are base64url, never ".".
export function sessionToken(secret, learnerId, issuedAt = Math.floor(Date.now() / 1000)) {
  const body = `${learnerId}.${issuedAt}`;
  return `${body}.${sign(secret, "session", body)}`;
}

// The learner id of a token that's genuine and under 14 days old, or null. A token from before
// email sign-in (`id.sig`) isn't one.
export function verifySessionToken(secret, token, now = Date.now()) {
  const [id, issued, sig, extra] = String(token ?? "").split(".");
  if (extra !== undefined || !LEARNER_ID.test(id ?? "") || !/^\d{1,12}$/.test(issued ?? "") || !sig) return null;
  if (!safeEqual(sig, sign(secret, "session", `${id}.${issued}`))) return null;
  const age = now / 1000 - Number(issued);
  return age >= -300 && age < MAX_AGE_SECONDS ? id : null;
}

// The key a sandbox sends to the model passthrough. Distinct from the session token, so the
// key in a sandbox's .env can't be replayed as a browser session. Dot-separated: ids and
// signatures are base64url, which uses "_" and "-" but never ".".
export function llmKey(secret, learnerId) {
  return `cl.${learnerId}.${sign(secret, "llm", learnerId)}`;
}

export function verifyLlmKey(secret, key) {
  const match = String(key ?? "").match(/^cl\.([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]+)$/);
  if (!match) return null;
  return safeEqual(match[2], sign(secret, "llm", match[1])) ? match[1] : null;
}

export function codeMatches(expected, given) {
  if (!expected) return false;
  // Hash both so the comparison is constant-time whatever the lengths.
  const h = (v) => crypto.createHash("sha256").update(String(v ?? "").trim()).digest();
  return crypto.timingSafeEqual(h(expected), h(given));
}

// A sign-in code as stored: hashed with the secret and the email it was sent to.
export function hashSignInCode(secret, email, code) {
  return sign(secret, "signin-code", `${email}:${String(code ?? "").trim()}`);
}

export function newSignInCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// The e2e tests' code for one of their addresses: derived from E2E_SIGNIN_KEY, so the tests can
// sign in without a mailbox. The tests derive it the same way (e2e/env.mjs).
export function e2eSignInCode(key, email) {
  const digest = crypto.createHmac("sha256", key).update(`e2e-signin:${email}`).digest();
  return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

// Secure only over https, so plain-http local dev still gets the cookie. Host-only by default,
// which reaches the UI proxy on the same host's other port (local dev). Deployed, the UI proxy
// is a subdomain (ui.temporalquest.dev), and the cookie names the parent domain to reach it.
function cookieAttributes({ secure, domain, maxAge }) {
  return ["Path=/", ...(domain ? [`Domain=${domain}`] : []), "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`, ...(secure ? ["Secure"] : [])];
}

export function sessionCookie(token, { secure, domain = "" }) {
  return [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, ...cookieAttributes({ secure, domain, maxAge: MAX_AGE_SECONDS })].join("; ");
}

export function clearedSessionCookie({ secure, domain = "" }) {
  return [`${SESSION_COOKIE}=`, ...cookieAttributes({ secure, domain, maxAge: 0 })].join("; ");
}

// The Set-Cookie headers that sign a browser in. With a domain, the host-only cookie from
// before goes too: a browser holding both would send both, and the older could be someone
// else's.
export function sessionCookies(token, { secure, domain = "" }) {
  const cookie = sessionCookie(token, { secure, domain });
  return domain ? [clearedSessionCookie({ secure }), cookie] : [cookie];
}

// The Set-Cookie headers that sign a browser out: both cookies, when there's a domain.
export function clearedSessionCookies({ secure, domain = "" }) {
  return domain ? [clearedSessionCookie({ secure }), clearedSessionCookie({ secure, domain })] : [clearedSessionCookie({ secure })];
}

// When the UI proxy's public base is a subdomain of the site's (https://ui.example.com beside
// https://example.com): the host the main port serves it on, and the domain the session
// cookie names so that it reaches it. Otherwise neither, and the cookie stays host-only.
export function uiSubdomain(uiBase, siteUrl) {
  const none = { uiProxyHost: "", sessionCookieDomain: "" };
  if (!uiBase || !siteUrl) return none;
  try {
    const ui = new URL(uiBase);
    const site = new URL(siteUrl).hostname.toLowerCase();
    if (!ui.hostname.toLowerCase().endsWith(`.${site}`)) return none;
    return { uiProxyHost: ui.host.toLowerCase(), sessionCookieDomain: site };
  } catch {
    return none;
  }
}

// The raw session token a request carries, or null.
export function sessionTokenOf(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE] ?? null;
}

export function learnerFromRequest(secret, req) {
  return verifySessionToken(secret, sessionTokenOf(req));
}

// A value the browser holds but can't read or change (the helper's docs token): AES-256-GCM
// under a key derived from the session secret, bound to its purpose.
function sealKey(secret) {
  return crypto.createHash("sha256").update(`${secret}:seal`).digest();
}

export function seal(secret, purpose, value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sealKey(secret), iv);
  cipher.setAAD(Buffer.from(purpose));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal(secret, purpose, sealed) {
  try {
    const raw = Buffer.from(String(sealed ?? ""), "base64url");
    if (raw.length < 29) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", sealKey(secret), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

// A cookie of the runner's own, other than the session: HttpOnly, Lax, host-only, on a path.
export function plainCookie(name, value, { secure, path = "/", maxAge }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
