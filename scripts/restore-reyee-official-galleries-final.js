const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PRODUCT_FILE = "products-network.json";
const OUT_ROOT = "media/reyee-official";
const REPORT_FILE = "reports/reyee-gallery-final.csv";
const INDEX_URL = "https://reyee.ruijie.com/vi-vn/resources/products/";
const MAX_IMAGES = 5;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const slug = s => String(s || "").toLowerCase()
  .replace(/[()]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

function getItems(raw) {
  if (Array.isArray(raw)) return { items: raw, wrapped: false };
  if (raw && Array.isArray(raw.items)) return { items: raw.items, wrapped: true };
  throw new Error("products-network.json must be an array or {items:[...]}");
}

function modelOf(p) {
  return String(p.model || p.name || "")
    .replace(/^Reyee\s+/i, "")
    .trim();
}

function isReyee(p) {
  return String(p.brand || "").toLowerCase() === "reyee" ||
         /^Reyee\s+/i.test(String(p.name || ""));
}

function extFrom(contentType, url) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("png")) return ".png";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
  const m = String(url || "").match(/\.(png|jpe?g|webp)(?:[?#]|$)/i);
  if (m) return "." + m[1].toLowerCase().replace("jpeg", "jpg");
  return ".jpg";
}

async function main() {
  if (!fs.existsSync(PRODUCT_FILE)) throw new Error(`Missing ${PRODUCT_FILE}`);

  const raw = JSON.parse(fs.readFileSync(PRODUCT_FILE, "utf8"));
  const { items, wrapped } = getItems(raw);
  const reyee = items.filter(isReyee);

  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.mkdirSync("reports", { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    locale: "vi-VN"
  });
  const page = await context.newPage();

  console.log(`Opening official Reyee product index: ${INDEX_URL}`);
  await page.goto(INDEX_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(5000);

  const links = await page.locator("a").evaluateAll(els =>
    els.map(a => ({
      text: (a.textContent || "").trim(),
      href: a.href || ""
    })).filter(x => x.href)
  );

  const linkMap = new Map();
  for (const l of links) {
    const key = norm(l.text);
    if (!key) continue;
    if (/reyee\.ruijie\.com/i.test(l.href) && /\/products\//i.test(l.href)) {
      if (!linkMap.has(key)) linkMap.set(key, l.href);
    }
  }

  const report = [];

  for (let i = 0; i < reyee.length; i++) {
    const p = reyee[i];
    const model = modelOf(p);
    const key = norm(model);
    const oldCount = Array.isArray(p.images) ? p.images.length : 0;
    let productUrl = linkMap.get(key);

    // Fallback: find any link whose visible text normalizes exactly to model.
    if (!productUrl) {
      const hit = links.find(l => norm(l.text) === key && /reyee\.ruijie\.com/i.test(l.href));
      if (hit) productUrl = hit.href;
    }

    console.log(`[${i + 1}/${reyee.length}] ${model}`);

    if (!productUrl) {
      console.log("  NO_OFFICIAL_PRODUCT_LINK");
      report.push([model, "NO_OFFICIAL_PRODUCT_LINK", oldCount, oldCount, ""]);
      continue;
    }

    try {
      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(5000);

      // Scroll through page once so lazy-loaded gallery images receive currentSrc.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 800) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1500);

      const candidates = await page.locator("img").evaluateAll((els, model) => {
        const n = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const mk = n(model);
        return els.map((img, idx) => {
          const src = img.currentSrc || img.src || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
          const alt = img.alt || "";
          const title = img.title || "";
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;
          const box = img.getBoundingClientRect();
          let score = 0;
          if (n(alt).includes(mk)) score += 1000;
          if (n(title).includes(mk)) score += 700;
          if (n(src).includes(mk)) score += 500;
          if (/product|gallery|swiper|carousel|goods|detail/i.test(src)) score += 120;
          if (w >= 800) score += 120;
          else if (w >= 500) score += 80;
          else if (w >= 300) score += 30;
          if (h >= 300) score += 30;
          if (/logo|icon|flag|qr|avatar|favicon|loading|placeholder|banner|wechat|facebook|youtube|arrow|close/i.test(src)) score -= 1000;
          if (w < 250 || h < 180) score -= 400;
          return { idx, src, alt, title, w, h, score, visible: box.width > 0 && box.height > 0 };
        }).filter(x => x.src && x.score > 0);
      }, model);

      // Strong preference for official gallery images carrying the exact model in alt.
      candidates.sort((a, b) => b.score - a.score || (b.w * b.h) - (a.w * a.h));

      const seen = new Set();
      const selected = [];
      for (const c of candidates) {
        const u = c.src.split("#")[0];
        if (seen.has(u)) continue;
        seen.add(u);
        selected.push(c);
        if (selected.length >= 12) break; // try extra candidates in case some downloads fail
      }

      if (!selected.length) {
        console.log("  NO_RENDERED_GALLERY");
        report.push([model, "NO_RENDERED_GALLERY", oldCount, oldCount, productUrl]);
        continue;
      }

      const outDir = path.join(OUT_ROOT, p.id || slug(model));
      const tmpDir = outDir + "-tmp";
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(tmpDir, { recursive: true });

      const saved = [];
      for (const c of selected) {
        if (saved.length >= MAX_IMAGES) break;
        try {
          // Direct download using Playwright request context so cookies/headers match browser session.
          const resp = await context.request.get(c.src, {
            timeout: 30000,
            headers: { Referer: productUrl }
          });
          if (!resp.ok()) throw new Error(`HTTP ${resp.status()}`);
          const body = await resp.body();
          const ct = resp.headers()["content-type"] || "";
          if (!ct.startsWith("image/") || body.length < 20000) throw new Error("not a usable image");
          const ext = extFrom(ct, c.src);
          const out = path.join(tmpDir, `image-${saved.length + 1}${ext}`);
          fs.writeFileSync(out, body);
          saved.push(out);
        } catch (e) {
          // Last-resort deterministic fallback: screenshot the rendered <img> element itself.
          try {
            const loc = page.locator("img").nth(c.idx);
            if (await loc.isVisible()) {
              const out = path.join(tmpDir, `image-${saved.length + 1}.png`);
              await loc.screenshot({ path: out, omitBackground: false });
              if (fs.statSync(out).size >= 10000) saved.push(out);
              else fs.rmSync(out, { force: true });
            }
          } catch {}
        }
      }

      if (!saved.length) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log("  DOWNLOAD_FAILED_KEEP_OLD");
        report.push([model, "DOWNLOAD_FAILED_KEEP_OLD", oldCount, oldCount, productUrl]);
        continue;
      }

      // Replace only after a complete usable set exists.
      fs.rmSync(outDir, { recursive: true, force: true });
      fs.renameSync(tmpDir, outDir);

      const newPaths = fs.readdirSync(outDir)
        .filter(f => /^image-\d+\.(png|jpe?g|webp)$/i.test(f))
        .sort((a, b) => {
          const na = Number((a.match(/image-(\d+)/)||[])[1]||0);
          const nb = Number((b.match(/image-(\d+)/)||[])[1]||0);
          return na - nb;
        })
        .map(f => path.join(outDir, f).replace(/\\/g, "/"));

      p.images = newPaths;
      console.log(`  RESTORED ${oldCount} -> ${newPaths.length}`);
      report.push([model, "RESTORED", oldCount, newPaths.length, productUrl]);

      await sleep(250);
    } catch (e) {
      console.log(`  ERROR_KEEP_OLD: ${e.message}`);
      report.push([model, "ERROR_KEEP_OLD", oldCount, oldCount, productUrl || ""]);
    }
  }

  await browser.close();

  const outRaw = wrapped ? { ...raw, items } : items;
  fs.writeFileSync(PRODUCT_FILE, JSON.stringify(outRaw, null, 2) + "\n");

  const csv = [
    ["model", "status", "old_count", "new_count", "official_page"],
    ...report
  ].map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";

  fs.writeFileSync(REPORT_FILE, csv);
  console.log(`Report: ${REPORT_FILE}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
