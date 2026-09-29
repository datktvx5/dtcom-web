const fs = require('fs');
const path = require('path');

const root = process.cwd();
const productsPath = path.join(root, 'products.json');
const pagesPath = path.join(root, '.pages.yml');
const mediaRoot = path.join(root, 'media');
const OTHER = 'Khác / thêm mới';

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}
function cleanWebPath(value) {
  if (!value) return '';
  let s = String(value).trim().replace(/\\/g, '/');
  return s.replace(/^\.\//, '').replace(/^\//, '');
}
function isRemote(value) { return /^(https?:|data:|blob:)/i.test(String(value || '')); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function sameFile(a, b) {
  try {
    const sa = fs.statSync(a), sb = fs.statSync(b);
    return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch { return false; }
}
function uniqueDestination(dir, filename, src) {
  const parsed = path.parse(filename);
  let dest = path.join(dir, filename);
  if (!fs.existsSync(dest) || sameFile(src, dest)) return dest;
  let i = 2;
  while (true) {
    const candidate = path.join(dir, `${parsed.name}-${i}${parsed.ext}`);
    if (!fs.existsSync(candidate) || sameFile(src, candidate)) return candidate;
    i++;
  }
}
function moveMedia(value, productFolder) {
  if (!value || isRemote(value)) return value;
  const clean = cleanWebPath(value);
  if (!clean || !clean.startsWith('media/')) return value;
  const source = path.join(root, clean);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) return value;
  const destDir = path.join(mediaRoot, productFolder);
  ensureDir(destDir);
  const wantedPrefix = `media/${productFolder}/`;
  if (clean.startsWith(wantedPrefix)) return '/' + clean;
  const dest = uniqueDestination(destDir, path.basename(clean), source);
  if (path.resolve(source) !== path.resolve(dest)) fs.renameSync(source, dest);
  return '/' + path.relative(root, dest).replace(/\\/g, '/');
}
function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) removeEmptyDirs(p);
  }
  if (dir !== mediaRoot && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
function yamlValue(value) {
  const s = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${s}"`;
}
function unquoteYamlValue(line) {
  let s = line.trim().replace(/^-[ ]*/, '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}
function ensureSelectOptions(yaml, fieldName, values) {
  const lines = yaml.split(/\r?\n/);
  const fieldRe = new RegExp(`^\\s*- name: ${fieldName}\\s*$`);
  const start = lines.findIndex(line => fieldRe.test(line));
  if (start < 0) return yaml;
  let end = lines.length;
  const fieldIndent = (lines[start].match(/^\s*/) || [''])[0].length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)- name:/);
    if (m && m[1].length === fieldIndent) { end = i; break; }
  }
  let valuesLine = -1;
  for (let i = start; i < end; i++) if (/^\s*values:\s*$/.test(lines[i])) { valuesLine = i; break; }
  if (valuesLine < 0) return yaml;
  const optionIndent = (lines[valuesLine].match(/^\s*/) || [''])[0] + '  ';
  let optionStart = valuesLine + 1, optionEnd = optionStart;
  while (optionEnd < end && (lines[optionEnd].trim() === '' || lines[optionEnd].startsWith(optionIndent + '- '))) optionEnd++;
  const current = [];
  for (let i = optionStart; i < optionEnd; i++) if (lines[i].startsWith(optionIndent + '- ')) current.push(unquoteYamlValue(lines[i]));
  const merged = [];
  for (const v of [...current, ...values]) {
    const val = String(v || '').trim();
    if (!val || val === OTHER || merged.some(x => x.toLowerCase() === val.toLowerCase())) continue;
    merged.push(val);
  }
  merged.push(OTHER);
  lines.splice(optionStart, optionEnd - optionStart, ...merged.map(v => optionIndent + '- ' + yamlValue(v)));
  return lines.join('\n');
}

const learnablePairs = [
  ['camera_brand','camera_brand_new'],['camera_type','camera_type_new'],['camera_resolution','camera_resolution_new'],
  ['camera_connection','camera_connection_new'],['camera_lens','camera_lens_new'],['camera_night','camera_night_new'],
  ['camera_audio','camera_audio_new'],['camera_storage','camera_storage_new'],
  ['computer_brand','computer_brand_new'],['computer_type','computer_type_new'],['computer_cpu','computer_cpu_new'],
  ['computer_ram','computer_ram_new'],['computer_storage','computer_storage_new'],['computer_gpu','computer_gpu_new'],
  ['computer_screen','computer_screen_new'],['computer_refresh','computer_refresh_new'],
  ['printer_brand','printer_brand_new'],['printer_type','printer_type_new'],['printer_paper','printer_paper_new'],
  ['printer_color','printer_color_new'],['printer_functions','printer_functions_new'],['printer_duplex','printer_duplex_new'],
  ['printer_connection','printer_connection_new'],['printer_speed','printer_speed_new'],
  ['network_brand','network_brand_new'],['network_type','network_type_new'],['network_wifi','network_wifi_new'],
  ['network_speed','network_speed_new'],['network_ports','network_ports_new'],['network_poe','network_poe_new'],
  ['network_management','network_management_new'],['warranty','warranty_new']
];
const categoryMap = { camera:'Camera', computer:'Máy tính', printer:'Máy in', network:'Thiết bị mạng' };
const brandFieldMap = { camera:'camera_brand', computer:'computer_brand', printer:'printer_brand', network:'network_brand' };
const modelFieldMap = { camera:'camera_model', computer:'computer_model', printer:'printer_model', network:'network_model' };

function applyLearnable(obj, field, newField, learned) {
  if (!obj || typeof obj !== 'object') return false;
  let changed = false;
  const custom = String(obj[newField] || '').trim();
  let value = obj[field];
  if (Array.isArray(value)) {
    value = value.filter(v => v && v !== OTHER);
    if (custom && !value.some(v => String(v).toLowerCase() === custom.toLowerCase())) value.push(custom);
    if (JSON.stringify(value) !== JSON.stringify(obj[field])) { obj[field] = value; changed = true; }
    if (custom) { delete obj[newField]; changed = true; }
    for (const v of value) learned.add(String(v).trim());
  } else {
    if (custom) {
      if (obj[field] !== custom) { obj[field] = custom; changed = true; }
      delete obj[newField]; changed = true;
      learned.add(custom);
    } else if (value === OTHER) {
      obj[field] = ''; changed = true;
    } else if (value) learned.add(String(value).trim());
  }
  return changed;
}

function main() {
  if (!fs.existsSync(productsPath)) throw new Error('products.json not found');
  ensureDir(mediaRoot);
  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  if (!Array.isArray(products)) throw new Error('products.json must contain an array');
  const activeFolders = new Set(), usedIds = new Set();
  const learned = Object.fromEntries(learnablePairs.map(([field]) => [field, new Set()]));
  let changed = false;

  function nextUniqueId(base) {
    let id = base || 'san-pham';
    if (!usedIds.has(id)) { usedIds.add(id); return id; }
    let i = 2; while (usedIds.has(`${id}-${i}`)) i++;
    const unique = `${id}-${i}`; usedIds.add(unique); return unique;
  }
  for (const product of products) {
    const existing = slugify(product.id);
    if (existing && !usedIds.has(existing)) usedIds.add(existing);
  }

  for (const product of products) {
    let id = slugify(product.id);
    if (!id) { id = nextUniqueId(slugify(product.name) || 'san-pham'); product.id = id; changed = true; }
    else if (product.id !== id) { product.id = id; changed = true; }
    activeFolders.add(id);

    const blocks = Array.isArray(product.quick_specs) ? product.quick_specs : [];
    const profile = blocks[0] && typeof blocks[0] === 'object' ? blocks[0] : null;
    if (profile) {
      const kind = String(profile.kind || '').trim();
      if (categoryMap[kind] && product.category !== categoryMap[kind]) { product.category = categoryMap[kind]; changed = true; }
      const brandField = brandFieldMap[kind];
      const modelField = modelFieldMap[kind];
      if (brandField && profile[brandField] && product.brand !== profile[brandField]) { product.brand = profile[brandField]; changed = true; }
      if (modelField && profile[modelField] && product.model !== profile[modelField]) { product.model = profile[modelField]; changed = true; }
      for (const [field,newField] of learnablePairs) if (Object.prototype.hasOwnProperty.call(profile, field) || Object.prototype.hasOwnProperty.call(profile, newField)) changed = applyLearnable(profile, field, newField, learned[field]) || changed;
    }
    changed = applyLearnable(product, 'warranty', 'warranty_new', learned.warranty) || changed;

    if ((!Array.isArray(product.images) || product.images.length === 0) && product.image) { product.images = [product.image]; delete product.image; changed = true; }
    if (Array.isArray(product.images)) {
      const nextImages = product.images.filter(Boolean).map(src => moveMedia(src, id));
      if (JSON.stringify(nextImages) !== JSON.stringify(product.images)) changed = true;
      product.images = nextImages;
    }
    if (product.video) {
      const nextVideo = moveMedia(product.video, id);
      if (nextVideo !== product.video) changed = true;
      product.video = nextVideo;
    }
  }

  if (fs.existsSync(mediaRoot)) {
    for (const entry of fs.readdirSync(mediaRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && !activeFolders.has(entry.name)) { fs.rmSync(path.join(mediaRoot, entry.name), { recursive: true, force: true }); changed = true; }
    }
  }
  removeEmptyDirs(mediaRoot);
  if (changed) fs.writeFileSync(productsPath, JSON.stringify(products, null, 2) + '\n', 'utf8');

  if (fs.existsSync(pagesPath)) {
    let yaml = fs.readFileSync(pagesPath, 'utf8');
    for (const [field] of learnablePairs) yaml = ensureSelectOptions(yaml, field, [...learned[field]]);
    const old = fs.readFileSync(pagesPath, 'utf8');
    if (yaml !== old) { fs.writeFileSync(pagesPath, yaml.endsWith('\n') ? yaml : yaml + '\n', 'utf8'); changed = true; }
  }
  console.log(changed ? 'Products, media and preset options updated.' : 'No changes needed.');
}
main();
