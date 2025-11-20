const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'icons-export', 'xiaocaitest');
const publicIconsDir = path.join(repoRoot, 'packages', 'fossflow-app', 'public', 'icons-export');
const publicIndex = path.join(publicIconsDir, 'icons-index.json');

if (!fs.existsSync(srcDir)) {
  console.error('源目录不存在:', srcDir);
  process.exit(1);
}
if (!fs.existsSync(publicIconsDir)) {
  console.error('目标 icons-export 目录不存在:', publicIconsDir);
  process.exit(1);
}

// copy folder
const destDir = path.join(publicIconsDir, 'xiaocaitest');
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(src, e.name);
    const destPath = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

copyDir(srcDir, destDir);
console.log('已复制到', destDir);

// load public index
let indexArr = [];
try {
  const raw = fs.readFileSync(publicIndex, 'utf8');
  indexArr = JSON.parse(raw);
} catch (err) {
  console.error('无法读取或解析 public icons-index.json:', err.message);
  process.exit(1);
}

// build entries for each svg
const files = fs.readdirSync(destDir).filter(f => f.toLowerCase().endsWith('.svg'));
const newEntries = files.map(f => {
  const id = path.basename(f, '.svg');
  return {
    id: id,
    name: id,
    category: 'xiaocaitest',
    path: `xiaocaitest/${f}`,
    url: `/icons-export/xiaocaitest/${f}`
  };
});

// skip existing ids
const existingIds = new Set(indexArr.map(i => i.id));
const toAppend = newEntries.filter(e => !existingIds.has(e.id));

if (toAppend.length === 0) {
  console.log('没有新的条目需要追加。');
  process.exit(0);
}

const merged = indexArr.concat(toAppend);
fs.writeFileSync(publicIndex, JSON.stringify(merged, null, 2), 'utf8');
console.log(`已追加 ${toAppend.length} 条目到 ${publicIndex}`);
process.exit(0);
