const fs = require('fs');
const path = require('path');

const root = process.cwd();
const productsPath = path.join(root, 'products.json');
const mediaRoot = path.join(root, 'media');

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function cleanWebPath(value) {
  if (!value) return '';
  let s = String(value).trim().replace(/\\/g, '/');
  s = s.replace(/^\.\//, '');
  s = s.replace(/^\//, '');
  return s;
}

function isRemote(value) {
  return /^(https?:|data:|blob:)/i.test(String(value || ''));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sameFile(a, b) {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    return sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
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
  if (!clean) return value;

  // Keep non-media assets such as placeholder.svg untouched.
  if (!clean.startsWith('media/')) return value;

  const source = path.join(root, clean);
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) return value;

  const destDir = path.join(mediaRoot, productFolder);
  ensureDir(destDir);

  // Already in the correct folder.
  const wantedPrefix = `media/${productFolder}/`;
  if (clean.startsWith(wantedPrefix)) return '/' + clean;

  const filename = path.basename(clean);
  const dest = uniqueDestination(destDir, filename, source);

  if (path.resolve(source) !== path.resolve(dest)) {
    ensureDir(path.dirname(dest));
    fs.renameSync(source, dest);
  }

  const rel = path.relative(root, dest).replace(/\\/g, '/');
  return '/' + rel;
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) removeEmptyDirs(p);
  }
  if (dir !== mediaRoot && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

function main() {
  if (!fs.existsSync(productsPath)) throw new Error('products.json not found');
  ensureDir(mediaRoot);

  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  if (!Array.isArray(products)) throw new Error('products.json must contain an array');

  const activeFolders = new Set();
  const usedIds = new Set();
  let changed = false;

  function nextUniqueId(base) {
    let id = base || 'san-pham';
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    let i = 2;
    while (usedIds.has(`${id}-${i}`)) i++;
    const unique = `${id}-${i}`;
    usedIds.add(unique);
    return unique;
  }

  // Reserve valid existing IDs first so URLs stay stable when product names change.
  for (const product of products) {
    const existing = slugify(product.id);
    if (existing && !usedIds.has(existing)) usedIds.add(existing);
  }

  for (const product of products) {
    let id = slugify(product.id);
    if (!id) {
      // New product: create the URL/product code automatically from the product name.
      // Do not regenerate existing IDs later; this keeps published URLs stable.
      const base = slugify(product.name) || 'san-pham';
      // Temporarily free the base if it was only pre-reserved by this product (there is no ID here).
      id = nextUniqueId(base);
      product.id = id;
      changed = true;
    } else {
      // Keep the exact stored ID normalized, without changing it when the name is edited.
      if (product.id !== id) {
        product.id = id;
        changed = true;
      }
    }

    const folder = id;
    if (!folder) continue;
    activeFolders.add(folder);

    // Legacy single image -> images[] migration.
    if ((!Array.isArray(product.images) || product.images.length === 0) && product.image) {
      product.images = [product.image];
      delete product.image;
      changed = true;
    }

    if (Array.isArray(product.images)) {
      const nextImages = product.images
        .filter(Boolean)
        .map(src => moveMedia(src, folder));
      if (JSON.stringify(nextImages) !== JSON.stringify(product.images)) changed = true;
      product.images = nextImages;
    }

    if (product.video) {
      const nextVideo = moveMedia(product.video, folder);
      if (nextVideo !== product.video) changed = true;
      product.video = nextVideo;
    }
  }

  // Delete generated product folders that no longer belong to any current product.
  if (fs.existsSync(mediaRoot)) {
    for (const entry of fs.readdirSync(mediaRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dirName = entry.name;
      if (!activeFolders.has(dirName)) {
        fs.rmSync(path.join(mediaRoot, dirName), { recursive: true, force: true });
        changed = true;
      }
    }
  }

  removeEmptyDirs(mediaRoot);

  if (changed) {
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2) + '\n', 'utf8');
    console.log('Product media organized and products.json updated.');
  } else {
    console.log('No media changes needed.');
  }
}

main();

