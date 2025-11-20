const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const publicIconsDir = path.join(repoRoot, 'packages', 'fossflow-app', 'public', 'icons-export');
const destDir = path.join(publicIconsDir, 'xiaocaitest');
const publicIndex = path.join(publicIconsDir, 'icons-index.json');

if (!fs.existsSync(destDir)) {
  console.error('目标目录不存在:', destDir);
  process.exit(1);
}
if (!fs.existsSync(publicIndex)) {
  console.error('找不到 public icons-index.json:', publicIndex);
  process.exit(1);
}

let indexArr = JSON.parse(fs.readFileSync(publicIndex, 'utf8'));
const existingIds = new Set(indexArr.map(i => i.id));

const files = fs.readdirSync(destDir).filter(f => f.toLowerCase().endsWith('.svg'));
const toAppend = [];

for (const f of files) {
  const base = path.basename(f, '.svg');
  const id = `xiaocaitest-${base}`;
  if (existingIds.has(id)) continue;
  const entry = {
    id: id,
    name: base,
    category: 'xiaocaitest',
    path: `xiaocaitest/${f}`,
    url: `/icons-export/xiaocaitest/${f}`
  };
  toAppend.push(entry);
}

if (toAppend.length === 0) {
  console.log('没有新的条目需要追加（所有 id 已存在）。');
  process.exit(0);
}

indexArr = indexArr.concat(toAppend);
fs.writeFileSync(publicIndex, JSON.stringify(indexArr, null, 2), 'utf8');
console.log(`已追加 ${toAppend.length} 条目到 ${publicIndex}`);
