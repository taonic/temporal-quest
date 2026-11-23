// Renders og-image.html to web/public/og-image.png, the link preview index.html names.
// Uses the e2e tests' Playwright:   node og/render.mjs
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../e2e/package.json", import.meta.url));
const { chromium } = require("playwright");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(new URL("og-image.html", import.meta.url).href);
await page.evaluate(() => document.fonts.ready);
const out = fileURLToPath(new URL("../web/public/og-image.png", import.meta.url));
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out}`);
