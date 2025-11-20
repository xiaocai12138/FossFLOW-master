/**
 * 清理脚本：只在根目录 icons-export/xiaocaitest 中保留 Nginx.svg，删除其他文件
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const xiaocaitestDir = path.join(repoRoot, 'icons-export', 'xiaocaitest');

if (!fs.existsSync(xiaocaitestDir)) {
  console.log('xiaocaitest 文件夹不存在，无需清理。');
  process.exit(0);
}

const files = fs.readdirSync(xiaocaitestDir);
let deleted = 0;

for (const file of files) {
  if (file.toLowerCase() !== 'nginx.svg') {
    const filePath = path.join(xiaocaitestDir, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`已删除: ${file}`);
      deleted += 1;
    } catch (err) {
      console.error(`删除失败: ${file} - ${err.message}`);
    }
  }
}

console.log(`\n共删除 ${deleted} 个文件。只保留 Nginx.svg`);
console.log('请运行同步脚本来更新索引: node scripts/sync-icons-to-public.js');
