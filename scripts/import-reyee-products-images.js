const fs = require("fs");
const path = require("path");

const IMPORT_FILE = "imports/reyee-router-ap-switch-105.json";
const TARGET_FILE = "products-network.json";
const MEDIA_ROOT = path.join("media", "reyee");

const sleep = ms => new Promise(r => setTimeout(r, ms));
const slugify = s => String(s || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[()]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

function getItems(raw) {
  if (Array.isArray(raw)) return {items: raw, wrapped: false};
  if (raw && Array.isArray(raw.items)) return {items: raw.items, wrapped: true};
  return {items: [], wrapped: false};
}

function modelFromName(name) {
  const s = String(name || "").replace(/^Reyee\s+/i, "").trim();
  return s.split(/\s+-\s+|\s+(?=[A-Z][a-z])/)[0].trim();
}

function productPageCandidates(p) {
  const model = modelFromName(p.name);
  const slug = slugify(model);
  const type = String(p.product_type || "").toLowerCase();
  const sub = String(p.subcategory || "").toLowerCase();
  const base = "https://reyee.ruijie.com/en-global/products";
  const out = [];

  if (sub === "router") {
    out.push(`${base}/reyee-router/eg-series/${slug}/`);
    out.push(`${base}/reyee-router/cloud-managed-router/${slug}/`);
  }

  if (sub === "access point") {
    if (type.includes("wall")) out.push(`${base}/reyee-wireless/reyee-wall-ap/${slug}/`);
    if (type.includes("outdoor")) out.push(`${base}/reyee-wireless/reyee-outdoor-ap/${slug}/`);
    if (type.includes("ceiling")) out.push(`${base}/reyee-wireless/reyee-indoor-ap/${slug}/`);
    if (type.includes("optical")) {
      out.push(`${base}/e-lighten/e-lighten-access-points/${slug}/`);
      out.push(`${base}/e-lighten/e-lighten-access-point/${slug}/`);
    }
    // fallbacks
    out.push(`${base}/reyee-wireless/reyee-indoor-ap/${slug}/`);
    out.push(`${base}/reyee-wireless/reyee-wall-ap/${slug}/`);
    out.push(`${base}/reyee-wireless/reyee-outdoor-ap/${slug}/`);
  }

  if (sub === "switch") {
    if (type.includes("industrial")) out.push(`${base}/reyee-switch/industrial-switch/${slug}/`);
    if (type.includes("unmanaged")) out.push(`${base}/reyee-switch/unmanaged-switch/${slug}/`);
    if (type.includes("layer 3") || type.includes("core") || type.includes("modular"))
      out.push(`${base}/reyee-switch/l3-managed-switch/${slug}/`);
    if (type.includes("layer 2") || type.includes("poe") || type.includes("cloud"))
      out.push(`${base}/reyee-switch/l2-managed-switch/${slug}/`);

    // e-Lighten fallbacks
    out.push(`${base}/e-lighten/e-lighten-core-switch/${slug}/`);
    out.push(`${base}/e-lighten/e-lighten-access-switch/${slug}/`);

    // broad switch fallbacks
    out.push(`${base}/reyee-switch/l2-managed-switch/${slug}/`);
    out.push(`${base}/reyee-switch/l3-managed-switch/${slug}/`);
    out.push(`${base}/reyee-switch/smart-cctv-switch/${slug}/`);
    out.push(`${base}/reyee-switch/unmanaged-switch/${slug}/`);
    out.push(`${base}/reyee-switch/industrial-switch/${slug}/`);
  }

  return [...new Set(out)];
}

function absoluteUrl(u, base) {
  try {
    u = u.replace(/&amp;/g, "&");
    if (u.startsWith("//")) return "https:" + u;
    return new URL(u, base).href;
  } catch { return null; }
}

function extractCandidateImages(html, pageUrl, model) {
  const found = [];
  const modelNorm = model.toLowerCase().replace(/[()]/g, "");

  // Prefer IMG tags whose alt/title contains the exact model.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const alt = ((tag.match(/\b(?:alt|title)=["']([^"']*)["']/i) || [])[1] || "").toLowerCase();
    const attrs = [...tag.matchAll(/\b(?:src|data-src|data-original|data-lazy-src)=["']([^"']+)["']/gi)].map(x => x[1]);
    for (const raw of attrs) {
      const u = absoluteUrl(raw, pageUrl);
      if (!u || !/\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test(u)) continue;
      let score = 0;
      if (alt.replace(/[()]/g, "").includes(modelNorm)) score += 100;
      const low = u.toLowerCase();
      if (low.includes(slugify(model))) score += 50;
      if (/logo|icon|banner|qr|avatar|flag|close/i.test(low)) score -= 80;
      found.push({url:u, score});
    }
  }

  // OpenGraph / JSON / CSS image URLs as fallback.
  const generic = [
    ...html.matchAll(/https?:\\?\/\\?\/[^"'<>\\\s]+?\.(?:png|jpe?g|webp)(?:\?[^"'<>\\\s]*)?/gi)
  ].map(m => m[0].replace(/\\\//g, "/"));

  for (const raw of generic) {
    const u = absoluteUrl(raw, pageUrl);
    if (!u) continue;
    const low = u.toLowerCase();
    let score = 0;
    if (low.includes(slugify(model))) score += 50;
    if (/background\/other|product|upload|image/i.test(low)) score += 8;
    if (/logo|icon|banner|qr|avatar|flag|close/i.test(low)) score -= 80;
    found.push({url:u, score});
  }

  const best = new Map();
  for (const x of found) {
    if (!best.has(x.url) || best.get(x.url).score < x.score) best.set(x.url, x);
  }
  return [...best.values()].sort((a,b) => b.score - a.score);
}

async function fetchText(url) {
  const r = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (DTCOM product importer; compatible browser)",
      "accept-language": "en-US,en;q=0.9"
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return {text: await r.text(), finalUrl: r.url};
}

function extFromType(type, url) {
  type = String(type || "").toLowerCase();
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  const m = url.match(/\.(png|webp|jpe?g)(?:[?#]|$)/i);
  return m ? "." + m[1].toLowerCase().replace("jpeg","jpg") : ".jpg";
}

async function downloadFirstWorking(images, destBase) {
  for (const x of images.slice(0, 15)) {
    try {
      const r = await fetch(x.url, {
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0",
          "referer": "https://reyee.ruijie.com/"
        }
      });
      if (!r.ok) continue;
      const type = r.headers.get("content-type") || "";
      if (!type.startsWith("image/")) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 8000) continue;
      const ext = extFromType(type, x.url);
      const dest = destBase + ext;
      fs.mkdirSync(path.dirname(dest), {recursive:true});
      fs.writeFileSync(dest, buf);
      return dest.replace(/\\/g, "/");
    } catch {}
  }
  return null;
}

async function getImageForProduct(p) {
  const model = modelFromName(p.name);
  const folder = path.join(MEDIA_ROOT, slugify(model));
  const destBase = path.join(folder, "main");

  // Keep a local image if one already exists.
  if (fs.existsSync(folder)) {
    const existing = fs.readdirSync(folder).find(f => /^main\.(png|jpg|jpeg|webp)$/i.test(f));
    if (existing) return path.join(folder, existing).replace(/\\/g, "/");
  }

  for (const page of productPageCandidates(p)) {
    try {
      const {text, finalUrl} = await fetchText(page);
      if (!text.toLowerCase().includes(model.toLowerCase().replace(/[()]/g,"").split("-")[1]?.toLowerCase() || model.toLowerCase())) {
        // Still inspect page; many official pages use dynamic rendering.
      }
      const images = extractCandidateImages(text, finalUrl, model);
      const local = await downloadFirstWorking(images, destBase);
      if (local) return local;
    } catch {}
    await sleep(250);
  }
  return null;
}

(async () => {
  if (!fs.existsSync(IMPORT_FILE)) throw new Error(`Missing ${IMPORT_FILE}`);
  const importedRaw = JSON.parse(fs.readFileSync(IMPORT_FILE, "utf8"));
  const imported = getItems(importedRaw).items;

  let currentRaw = [];
  if (fs.existsSync(TARGET_FILE)) currentRaw = JSON.parse(fs.readFileSync(TARGET_FILE, "utf8"));
  const currentInfo = getItems(currentRaw);
  const current = currentInfo.items;

  const byId = new Map(current.map((p,i) => [String(p.id || ""), i]));
  const byName = new Map(current.map((p,i) => [String(p.name || "").trim().toLowerCase(), i]));

  // Merge without deleting or replacing existing user data.
  for (const p of imported) {
    const idKey = String(p.id || "");
    const nameKey = String(p.name || "").trim().toLowerCase();
    const idx = (idKey && byId.has(idKey)) ? byId.get(idKey) : byName.get(nameKey);

    if (idx === undefined) {
      current.push({...p});
      const ni = current.length - 1;
      if (idKey) byId.set(idKey, ni);
      byName.set(nameKey, ni);
    } else {
      // Fill only empty classification/description fields.
      for (const k of ["subcategory","product_type","brand","description"]) {
        if (!current[idx][k] && p[k]) current[idx][k] = p[k];
      }
    }
  }

  const targetModels = new Set(imported.map(p => modelFromName(p.name)));
  const report = [];
  let ok = 0, skipped = 0, failed = 0;

  for (let i=0; i<current.length; i++) {
    const p = current[i];
    const model = modelFromName(p.name);
    if (!targetModels.has(model)) continue;

    const existing = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    if (existing.length && !String(existing[0]).startsWith("http")) {
      report.push({model, status:"KEEP_EXISTING_LOCAL", image:existing[0]});
      skipped++;
      continue;
    }

    process.stdout.write(`[${ok+skipped+failed+1}] ${model} ... `);
    const local = await getImageForProduct(p);
    if (local) {
      p.images = [local];
      report.push({model, status:"DOWNLOADED", image:local});
      ok++;
      console.log("OK");
    } else {
      // Remove remote hotlink only for imported items if it was our old auto-link.
      if (existing.length && String(existing[0]).startsWith("http")) p.images = [];
      report.push({model, status:"NOT_FOUND", image:""});
      failed++;
      console.log("NOT FOUND");
    }
    await sleep(350);
  }

  // Preserve the original JSON wrapper style.
  const output = currentInfo.wrapped ? {...currentRaw, items: current} : current;
  fs.writeFileSync(TARGET_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");

  fs.mkdirSync("reports", {recursive:true});
  const lines = ["model,status,image", ...report.map(r =>
    [r.model,r.status,r.image].map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")
  )];
  fs.writeFileSync("reports/reyee-image-import.csv", lines.join("\n") + "\n", "utf8");

  console.log(`\nDone. Downloaded: ${ok}; kept existing: ${skipped}; not found: ${failed}`);
  if (failed) console.log("Check reports/reyee-image-import.csv for models needing manual review.");
})();
