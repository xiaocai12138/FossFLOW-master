const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const srcIcons = path.join(repoRoot, 'icons-export');
const publicIcons = path.join(repoRoot, 'packages', 'fossflow-app', 'public', 'icons-export');
const publicIndexFile = path.join(publicIcons, 'icons-index.json');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return { files: 0, dirs: 0 };
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let files = 0, dirs = 0;
  for (const e of entries) {
    const srcPath = path.join(src, e.name);
    const destPath = path.join(dest, e.name);
    if (e.isDirectory()) {
      const res = copyDir(srcPath, destPath);
      dirs += 1 + res.dirs;
      files += res.files;
    } else {
      fs.copyFileSync(srcPath, destPath);
      files += 1;
    }
  }
  return { files, dirs };
}

function loadJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return null; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// 1) copy entire icons-export -> public/icons-export
if (!fs.existsSync(srcIcons)) {
  console.error('源目录不存在:', srcIcons);
  process.exit(1);
}
if (!fs.existsSync(publicIcons)) fs.mkdirSync(publicIcons, { recursive: true });

console.log('复制图标文件夹...', srcIcons, '->', publicIcons);
const copyRes = copyDir(srcIcons, publicIcons);
console.log(`已复制 ${copyRes.files} 个文件 （${copyRes.dirs} 个子目录）`);

// 2) update icons-index.json in public
let indexArr = [];
const existingIndex = loadJson(publicIndexFile);
if (Array.isArray(existingIndex)) indexArr = existingIndex;
else {
  // try to find index file in srcIcons and copy it over
  const srcIndex = path.join(srcIcons, 'icons-index.json');
  const srcIndexObj = loadJson(srcIndex);
  if (Array.isArray(srcIndexObj)) {
    indexArr = srcIndexObj;
    console.log('使用根目录的 icons-index.json 作为初始索引');
  }
}

const existingIds = new Set(indexArr.map(i => i.id));
const existingPaths = new Set(indexArr.map(i => i.path));

// scan publicIcons subfolders for svg files and add missing entries
const entries = fs.readdirSync(publicIcons, { withFileTypes: true });
let added = 0;
for (const e of entries) {
  if (!e.isDirectory()) continue;
  const folder = e.name;
  const folderPath = path.join(publicIcons, folder);
  const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.svg'));
  for (const f of files) {
    const relPath = `${folder}/${f}`;
    if (existingPaths.has(relPath)) continue;
    const base = path.basename(f, '.svg');
    let id = base;
    if (existingIds.has(id)) id = `${folder}-${base}`;
    // ensure uniqueness
    let idx = 1;
    while (existingIds.has(id)) {
      id = `${folder}-${base}-${idx}`;
      idx += 1;
    }
    const entry = {
      id: id,
      name: base,
      category: folder,
      path: relPath,
      url: `/icons-export/${relPath}`
    };
    indexArr.push(entry);
    existingIds.add(id);
    existingPaths.add(relPath);
    added += 1;
  }
}

if (added > 0) {
  // backup old index if exists
  if (fs.existsSync(publicIndexFile)) fs.copyFileSync(publicIndexFile, publicIndexFile + '.bak');
  writeJson(publicIndexFile, indexArr);
  console.log(`已追加 ${added} 条索引到 ${publicIndexFile}（备份: ${publicIndexFile}.bak）`);
} else {
  console.log('未发现需要追加的索引条目。');
}

console.log('同步完成。请重载前端以查看更改。');
