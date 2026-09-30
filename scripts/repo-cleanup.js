const fs = require("fs");
const path = require("path");

const mode = String(process.argv[2] || "preview").toLowerCase();
const APPLY = mode === "apply";

const KEEP = new Set([
  ".github/workflows/organize-product-media.yml",
  ".github/workflows/restore-reyee-official-galleries-final.yml",
  ".github/workflows/repo-cleanup.yml",
  "scripts/organize-product-media.js",
  "scripts/restore-reyee-official-galleries-final.js",
  "products-camera.json",
  "products-computer.json",
  "products-printer.json",
  "products-network.json",
  "projects.json",
  ".pages.yml",
  "app.js",
  "product.js",
  "project.js",
  "nav.js",
  "index.html",
  "products.html",
  "product.html",
  "projects.html",
  "project.html",
  "services.html",
  "contact.html",
  "style.css",
  "placeholder.svg"
]);

const DELETE_DIRS = [
  "media/reyee-clean",
  "imports/reyee-clean",
  "reports"
];

const DELETE_FILES = [
  "reyee-clean-media.zip",
  "media/reyee-clean.zip"
];

const WORKFLOW_PATTERNS = [
  /^build-hikvision-.*\.ya?ml$/i,
  /^build-official-.*\.ya?ml$/i,
  /^dtcom-master-.*\.ya?ml$/i,
  /^rollback-master-.*\.ya?ml$/i,
  /^clean-reyee-products.*\.ya?ml$/i,
  /^retry-reyee-.*\.ya?ml$/i,
  /^enrich-reyee-.*\.ya?ml$/i,
  /^import-reyee-.*\.ya?ml$/i,
  /^restore-reyee-official-images.*\.ya?ml$/i
];

const SCRIPT_PATTERNS = [
  /^build-hikvision-.*\.js$/i,
  /^build-official-.*\.js$/i,
  /^dtcom-master-.*\.js$/i,
  /^rollback-master-.*\.js$/i,
  /^apply-reyee-cleanup\.js$/i,
  /^retry-reyee-.*\.js$/i,
  /^enrich-reyee-.*\.js$/i,
  /^import-reyee-.*\.js$/i,
  /^restore-reyee-official-images.*\.js$/i
];

function norm(p){ return p.replace(/\\/g,"/").replace(/^\.\/+/,""); }
function exists(p){ return fs.existsSync(p); }
function rm(p){
  if (!exists(p)) return;
  const n = norm(p);
  if (KEEP.has(n)) {
    console.log(`KEEP  ${n}`);
    return;
  }
  console.log(`${APPLY ? "DELETE" : "WOULD DELETE"}  ${n}`);
  if (APPLY) fs.rmSync(p, {recursive:true, force:true});
}

for (const d of DELETE_DIRS) rm(d);
for (const f of DELETE_FILES) rm(f);

function cleanPatternDir(dir, patterns){
  if (!exists(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const rel = norm(path.join(dir,name));
    if (KEEP.has(rel)) {
      console.log(`KEEP  ${rel}`);
      continue;
    }
    if (patterns.some(re => re.test(name))) rm(rel);
  }
}

cleanPatternDir(".github/workflows", WORKFLOW_PATTERNS);
cleanPatternDir("scripts", SCRIPT_PATTERNS);

for (const name of fs.readdirSync(".")) {
  if (/^(QA-contact-sheet.*\.(jpg|jpeg|png)|reyee-.*-summary\.csv|reyee-.*-report\.csv)$/i.test(name)) {
    rm(name);
  }
}

console.log("");
console.log(APPLY ? "Cleanup applied." : "Preview only. No files were changed.");
