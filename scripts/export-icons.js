#!/usr/bin/env node

/**
 * 导出 @isoflow/isopacks 中的所有图标到文件系统
 * 按类别分文件夹存储
 */

const fs = require('fs');
const path = require('path');

// 导入图标包
const isoflowPack = require('@isoflow/isopacks/dist/isoflow').default;
const awsPack = require('@isoflow/isopacks/dist/aws').default;
const gcpPack = require('@isoflow/isopacks/dist/gcp').default;
const azurePack = require('@isoflow/isopacks/dist/azure').default;
const kubernetesPack = require('@isoflow/isopacks/dist/kubernetes').default;

// 输出目录
const OUTPUT_DIR = path.join(__dirname, '..', 'icons-export');

// 扁平化图标集合
const flattenIcons = (collection) => {
  if (!collection || !collection.icons) {
    return [];
  }
  
  const result = [];
  
  collection.icons.forEach(icon => {
    if (icon.id && icon.url) {
      result.push(icon);
    }
  });
  
  return result;
};

// 获取所有图标包
const allPacks = [
  { pack: isoflowPack, name: 'isoflow' },
  { pack: awsPack, name: 'aws' },
  { pack: gcpPack, name: 'gcp' },
  { pack: azurePack, name: 'azure' },
  { pack: kubernetesPack, name: 'kubernetes' }
];

// 创建输出目录
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 创建索引文件
const index = [];

console.log('开始导出图标...\n');

allPacks.forEach(({ pack, name }) => {
  console.log(`处理 ${name} 图标包...`);
  
  const icons = flattenIcons(pack);
  const categoryDir = path.join(OUTPUT_DIR, name);
  
  // 创建类别文件夹
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
  }
  
  // 保存每个图标
  icons.forEach(icon => {
    const fileName = `${icon.id}.svg`;
    const filePath = path.join(categoryDir, fileName);
    
    try {
      // 如果 URL 是 data:image，需要转换
      if (icon.url && icon.url.startsWith('data:image/svg+xml;base64,')) {
        const base64Data = icon.url.replace(/^data:image\/svg\+xml;base64,/, '');
        const svgContent = Buffer.from(base64Data, 'base64').toString('utf8');
        fs.writeFileSync(filePath, svgContent);
      } else if (icon.url && icon.url.startsWith('data:')) {
        // 其他 data URL 格式
        const matches = icon.url.match(/data:([^;]+);base64,(.+)/);
        if (matches) {
          const svgContent = Buffer.from(matches[2], 'base64').toString('utf8');
          fs.writeFileSync(filePath, svgContent);
        }
      } else if (icon.url) {
        // 如果是普通 URL，直接写入
        fs.writeFileSync(filePath, icon.url);
      }
      
      // 添加到索引
      index.push({
        id: icon.id,
        name: icon.name || icon.id,
        category: name,
        path: `${name}/${fileName}`,
        url: icon.url ? icon.url.substring(0, 100) : 'N/A'
      });
    } catch (err) {
      console.error(`  ⚠️ 导出 ${icon.id} 失败: ${err.message}`);
    }
  });
  
  console.log(`✓ 导出 ${icons.length} 个 ${name} 图标\n`);
});

// 保存索引文件为 JSON
const indexPath = path.join(OUTPUT_DIR, 'icons-index.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

// 保存索引文件为 CSV（方便查看）
const csvPath = path.join(OUTPUT_DIR, 'icons-index.csv');
const csvContent = ['ID,Name,Category,Path'].concat(
  index.map(icon => `"${icon.id}","${icon.name}","${icon.category}","${icon.path}"`)
).join('\n');
fs.writeFileSync(csvPath, csvContent, 'utf8');

// 生成统计报告
const stats = {};
index.forEach(icon => {
  if (!stats[icon.category]) {
    stats[icon.category] = 0;
  }
  stats[icon.category]++;
});

console.log('📊 导出统计：');
console.log('─'.repeat(40));
Object.entries(stats).forEach(([category, count]) => {
  console.log(`  ${category}: ${count} 个图标`);
});
console.log('─'.repeat(40));
console.log(`  总计: ${index.length} 个图标\n`);

console.log(`✅ 导出完成！`);
console.log(`📁 输出目录: ${OUTPUT_DIR}`);
console.log(`📋 索引文件: ${indexPath}`);
console.log(`📊 CSV 报告: ${csvPath}\n`);

// 生成使用说明文件
const readmePath = path.join(OUTPUT_DIR, 'README.md');
const readmeContent = `# 导出的图标资源

## 结构
\`\`\`
icons-export/
├── isoflow/          # ISOFLOW 基础图标 (${stats.isoflow || 0} 个)
├── aws/              # AWS 服务图标 (${stats.aws || 0} 个)
├── gcp/              # Google Cloud 图标 (${stats.gcp || 0} 个)
├── azure/            # Microsoft Azure 图标 (${stats.azure || 0} 个)
├── kubernetes/       # Kubernetes 图标 (${stats.kubernetes || 0} 个)
├── icons-index.json  # 图标索引（JSON 格式）
├── icons-index.csv   # 图标索引（CSV 格式）
└── README.md         # 本文件
\`\`\`

## 总计
- **总图标数**: ${index.length}
- **分类数**: ${Object.keys(stats).length}

## 分类统计
${Object.entries(stats).map(([cat, count]) => `- **${cat}**: ${count} 个图标`).join('\n')}

## 使用方法

### 1. 在代码中直接引用

\`\`\`typescript
import isoflowIcon from './icons-export/isoflow/user.svg';

<img src={isoflowIcon} alt="user" />
\`\`\`

### 2. 使用索引 JSON 文件

\`\`\`typescript
import iconsIndex from './icons-export/icons-index.json';

// 按 ID 查找图标
const icon = iconsIndex.find(i => i.id === 'user');
console.log(icon.path); // => isoflow/user.svg
\`\`\`

### 3. 按类别列出所有图标

\`\`\`typescript
import iconsIndex from './icons-export/icons-index.json';

// 获取所有 AWS 图标
const awsIcons = iconsIndex.filter(i => i.category === 'aws');
\`\`\`

## 文件大小
- 每个 SVG 文件通常在 1-10 KB
- 总文件大小约为 5-10 MB

## 更新图标

如需更新图标，请重新运行导出脚本：

\`\`\`bash
npm run export:icons
\`\`\`

---
生成时间: ${new Date().toLocaleString('zh-CN')}
`;

fs.writeFileSync(readmePath, readmeContent, 'utf8');

console.log('📖 使用说明已生成: README.md\n');


fs.writeFileSync(readmePath, readmeContent, 'utf8');

console.log('📖 使用说明已生成: README.md\n');
