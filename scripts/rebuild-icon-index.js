/**
 * 根据 icons-export 目录下的真实 SVG 文件，重建：
 *   - icons-export/icons-index.json
 *   - icons-export/icons-index.csv
 * 并同步到 packages/fossflow-app/public/icons-export/。
 *
 * 与 sync-icons-to-public.js 的区别：本脚本同时重写源目录的索引，
 * 让仓库里的索引不再残留已删除图标（历史遗留的 aws/gcp/azure 幽灵条目）。
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const iconsRoot = path.join(repoRoot, 'icons-export');
const publicRoot = path.join(repoRoot, 'packages', 'fossflow-app', 'public', 'icons-export');

const scan = (root) => {
  if (!fs.existsSync(root)) return [];

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const rows = [];
  const usedIds = new Set();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const category = entry.name;
    const dir = path.join(root, category);
    const files = fs
      .readdirSync(dir)
      .filter((file) => file.toLowerCase().endsWith('.svg'))
      .sort();

    for (const file of files) {
      const base = path.basename(file, '.svg');
      let id = base;

      if (usedIds.has(id)) id = `${category}-${base}`;

      let suffix = 1;
      while (usedIds.has(id)) {
        id = `${category}-${base}-${suffix}`;
        suffix += 1;
      }

      usedIds.add(id);
      rows.push({
        id,
        name: base,
        category,
        path: `${category}/${file}`,
        url: `/icons-export/${category}/${file}`
      });
    }
  }

  return rows;
};

const toCsv = (rows) => {
  const escape = (value) => {
    const text = String(value);

    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = ['ID,Name,Category,Path,URL'];
  for (const row of rows) {
    lines.push(
      [row.id, row.name, row.category, row.path, row.url].map(escape).join(',')
    );
  }

  return `${lines.join('\n')}\n`;
};

const rows = scan(iconsRoot);

if (rows.length === 0) {
  console.error('未在 icons-export 下找到任何 SVG，索引未更新。');
  process.exit(1);
}

fs.writeFileSync(
  path.join(iconsRoot, 'icons-index.json'),
  `${JSON.stringify(rows, null, 2)}\n`,
  'utf8'
);
fs.writeFileSync(path.join(iconsRoot, 'icons-index.csv'), toCsv(rows), 'utf8');

if (fs.existsSync(publicRoot)) {
  fs.writeFileSync(
    path.join(publicRoot, 'icons-index.json'),
    `${JSON.stringify(rows, null, 2)}\n`,
    'utf8'
  );
}

const stats = rows.reduce((acc, row) => {
  acc[row.category] = (acc[row.category] || 0) + 1;
  return acc;
}, {});

console.log(`索引已重建：共 ${rows.length} 条`);
Object.entries(stats)
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([category, count]) => {
    console.log(`  ${category.padEnd(14)} ${count}`);
  });
