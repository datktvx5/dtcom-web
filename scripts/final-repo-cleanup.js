const fs = require("fs");
const path = require("path");

const mode = String(process.argv[2] || "preview").toLowerCase();
const APPLY = mode === "apply";

const KEEP_WORKFLOWS = new Set([
  ".github/workflows/organize-product-media.yml",
  ".github/workflows/sync-hero-banner.yml",
  ".github/workflows/final-repo-cleanup.yml"
]);

const KEEP_SCRIPTS = new Set([
  "scripts/organize-product-media.js",
  "scripts/sync-hero-banner.js",
  "scripts/final-repo-cleanup.js"
]);

// Runtime files currently used by the live site / CMS.
const KEEP_RUNTIME = new Set([
  ".pages.yml",
  "homepage.json",
  "top-ticker.css",
  "top-ticker.js",
  "site-polish.css",
  "site-polish.js",
  "site-contact-cms.js",
  "contact-icons-fix.css",
  "contact-icons-fix.js",

  "app.js",
  "product.js",
  "project.js",
  "nav.js",
  "style.css",
  "placeholder.svg",

  "index.html",
  "products.html",
  "product.html",
  "projects.html",
  "project.html",
  "services.html",
  "contact.html",

  "products-camera.json",
  "products-computer.json",
  "products-printer.json",
  "products-network.json",
  "projects.json"
]);

// Known temporary / generated folders safe to remove.
const DELETE_DIRS = [
  "reports",
  "imports"
];

// Known temporary files that should not remain in the repo.
const DELETE_FILES = [
  "reyee-clean-media.zip",
  "media/reyee-clean.zip",
  "QA-contact-sheet.jpg",
  "QA-contact-sheet.png"
];

// Every workflow except the 2 live workflows + this cleanup workflow is now obsolete.
function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map(name => path.join(dir, name).replace(/\\/g,"/"));
}

function remove(target) {
  if (!fs.existsSync(target)) return;
  console.log(`${APPLY ? "DELETE" : "WOULD DELETE"}  ${target}`);
  if (APPLY) fs.rmSync(target, {recursive:true, force:true});
}

console.log("=== KEEP LIVE WORKFLOWS ===");
for (const f of KEEP_WORKFLOWS) if (fs.existsSync(f)) console.log("KEEP   "+f);

console.log("\n=== REMOVE OLD WORKFLOWS ===");
for (const f of listFiles(".github/workflows")) {
  if (!KEEP_WORKFLOWS.has(f)) remove(f);
}

console.log("\n=== KEEP LIVE SCRIPTS ===");
for (const f of KEEP_SCRIPTS) if (fs.existsSync(f)) console.log("KEEP   "+f);

console.log("\n=== REMOVE OLD ONE-SHOT / INSTALL / FIX SCRIPTS ===");
for (const f of listFiles("scripts")) {
  if (!KEEP_SCRIPTS.has(f)) remove(f);
}

console.log("\n=== REMOVE REPORTS / IMPORT TEMP ===");
for (const d of DELETE_DIRS) remove(d);
for (const f of DELETE_FILES) remove(f);

// Remove stray root CSV reports and old ZIP bundles if they were uploaded to repository root.
for (const name of fs.readdirSync(".")) {
  if (/^(reyee|hikvision|ezviz|multibrand|network-accessories).*\.(csv|zip)$/i.test(name)) {
    remove(name);
  }
  if (/^DTCOM_.*\.zip$/i.test(name)) {
    remove(name);
  }
}

// Sanity report: never delete assets/ or media/ because live products may reference them.
console.log("\n=== PROTECTED DATA ===");
for (const d of ["assets","media"]) {
  if (fs.existsSync(d)) console.log("KEEP   "+d+"/  (all contents)");
}
for (const f of KEEP_RUNTIME) {
  if (fs.existsSync(f)) console.log("KEEP   "+f);
}

console.log("");
console.log(APPLY ? "FINAL CLEANUP APPLIED." : "PREVIEW ONLY - NOTHING WAS DELETED.");
