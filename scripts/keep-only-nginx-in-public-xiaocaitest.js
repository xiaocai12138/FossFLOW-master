/*
  删除 public icons-export/xiaocaitest 下除 Nginx.svg 外的文件
  并从 icons-index.json 中移除这些条目。会创建 icons-index.json.bak
*/
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const publicIconsDir = path.join(repoRoot, 'packages', 'fossflow-app', 'public', 'icons-export');
const targetDir = path.join(publicIconsDir, 'xiaocaitest');
const indexFile = path.join(publicIconsDir, 'icons-index.json');

function keepOnlyNginx() {
  if (!fs.existsSync(targetDir)) {
    console.error('target dir not found:', targetDir);
    process.exit(1);
  }

  const files = fs.readdirSync(targetDir);
  const keepName = 'Nginx.svg';

  // Delete files except keepName
  let deleted = 0;
  for (const f of files) {
    if (f === keepName) continue;
    const p = path.join(targetDir, f);
    try {
      fs.unlinkSync(p);
      deleted++;
    } catch (e) {
      console.warn('failed to delete', p, e.message);
    }
  }

  console.log(`Deleted ${deleted} files from ${targetDir}`);

  // Update icons-index.json
  if (!fs.existsSync(indexFile)) {
    console.warn('index file not found:', indexFile);
    return;
  }

  const raw = fs.readFileSync(indexFile, 'utf8');
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    console.error('failed to parse json index:', e.message);
    process.exit(1);
  }

  const bak = indexFile + '.bak.' + Date.now();
  fs.writeFileSync(bak, raw, 'utf8');
  console.log('Backup written to', bak);

  // Keep entries that are NOT in category xiaocaitest, plus the Nginx.svg entry
  const kept = arr.filter(entry => {
    if (!entry || entry.category !== 'xiaocaitest') return true;
    // entry.path like "xiaocaitest/Nginx.svg" or similar
    return entry.path && entry.path.toLowerCase().endsWith('/nginx.svg');
  });

  fs.writeFileSync(indexFile, JSON.stringify(kept, null, 2), 'utf8');
  console.log('Updated index file, removed other xiaocaitest entries.');
}

keepOnlyNginx();
