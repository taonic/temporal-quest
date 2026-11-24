// Renders the link preview and the touch icon index.html names, into web/public:
//   og-image.jpg          og-image.html at 2x (2400x1260). A JPEG, to keep it under the
//                         ~300 KB WhatsApp drops larger previews past.
//   apple-touch-icon.png  the Quest logo, 180x180, full-bleed: iOS rounds the corners itself.
// Uses the e2e tests' Playwright:   node og/render.mjs
import { createRequire } from "node:module";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../e2e/package.json", import.meta.url));
const { chromium } = require("playwright");
const publicFile = (name) => fileURLToPath(new URL(`../web/public/${name}`, import.meta.url));
const wrote = (path) => console.log(`Wrote ${path} (${Math.round(statSync(path).size / 1024)} KB)`);

const browser = await chromium.launch();

const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await og.goto(new URL("og-image.html", import.meta.url).href);
await og.evaluate(() => document.fonts.ready);
const ogOut = publicFile("og-image.jpg");
await og.screenshot({ path: ogOut, type: "jpeg", quality: 85 });
wrote(ogOut);

// The logo is the favicon's SVG in og-image.html; drop its rounded corners for the icon.
const logo = readFileSync(new URL("og-image.html", import.meta.url), "utf8")
  .match(/<div class="brand">(<svg[\s\S]*?<\/svg>)/)[1]
  .replace(/ rx="\d+"/, "");
const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
await icon.setContent(`<style>*{margin:0}svg{display:block;width:180px;height:180px}</style>${logo}`);
const iconOut = publicFile("apple-touch-icon.png");
await icon.screenshot({ path: iconOut });
wrote(iconOut);

await browser.close();
