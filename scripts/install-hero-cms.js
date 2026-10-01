const fs = require("fs");
const YAML = require("yaml");

const PAGES = ".pages.yml";
const SETTINGS = "homepage.json";

if (!fs.existsSync(PAGES)) {
  throw new Error("Missing .pages.yml");
}

const doc = YAML.parse(fs.readFileSync(PAGES,"utf8")) || {};
doc.content = Array.isArray(doc.content) ? doc.content : [];

doc.content = doc.content.filter(x => x && x.name !== "homepage_banner");

doc.content.push({
  name: "homepage_banner",
  label: "Banner trang chủ",
  type: "file",
  path: SETTINGS,
  operations: {
    create: false,
    rename: false,
    delete: false
  },
  fields: [
    {
      name: "hero_image",
      label: "Ảnh Hero Banner",
      type: "image",
      required: true,
      description: "Chọn hoặc tải ảnh PNG dùng cho banner lớn đầu trang. Khuyến nghị 1920 × 800 px.",
      options: {
        extensions: ["png"],
        categories: ["image"],
        rename: false
      }
    }
  ]
});

fs.writeFileSync(PAGES, YAML.stringify(doc), "utf8");

if (!fs.existsSync(SETTINGS)) {
  fs.writeFileSync(
    SETTINGS,
    JSON.stringify({ hero_image: "/media/hero-banner.png" }, null, 2) + "\n",
    "utf8"
  );
}

console.log("Installed Pages CMS item: Banner trang chủ");
