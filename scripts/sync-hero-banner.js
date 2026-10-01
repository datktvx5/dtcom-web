const fs = require("fs");
const path = require("path");

const SETTINGS = "homepage.json";

// IMPORTANT:
// The live homepage uses the original banner file in assets/,
// not media/hero-banner.png.
const FIXED = path.join("assets","hero-banner.png");

if (!fs.existsSync(SETTINGS)) {
  throw new Error("Missing homepage.json");
}

const cfg = JSON.parse(fs.readFileSync(SETTINGS,"utf8"));
let src = String(cfg.hero_image || "").trim().replace(/\\/g,"/");

if (!src) throw new Error("hero_image is empty");

if (/^https?:\/\//i.test(src)) {
  throw new Error("hero_image must be a repository file, not an external URL");
}

src = src.replace(/^\.\//,"").replace(/^\//,"");

if (!fs.existsSync(src)) {
  throw new Error(`Selected banner does not exist: ${src}`);
}

if (path.extname(src).toLowerCase() !== ".png") {
  throw new Error("Hero banner must be a .png file");
}

fs.mkdirSync(path.dirname(FIXED), {recursive:true});

if (path.resolve(src) !== path.resolve(FIXED)) {
  fs.copyFileSync(src, FIXED);
  console.log(`Copied ${src} -> ${FIXED}`);
} else {
  console.log("Selected image is already assets/hero-banner.png");
}
