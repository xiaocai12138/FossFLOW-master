# 导出的图标资源

## 结构
```
icons-export/
├── isoflow/          # ISOFLOW 基础图标 (37 个)
├── aws/              # AWS 服务图标 (320 个)
├── gcp/              # Google Cloud 图标 (217 个)
├── azure/            # Microsoft Azure 图标 (448 个)
├── kubernetes/       # Kubernetes 图标 (40 个)
├── icons-index.json  # 图标索引（JSON 格式）
├── icons-index.csv   # 图标索引（CSV 格式）
└── README.md         # 本文件
```

## 总计
- **总图标数**: 1062
- **分类数**: 5

## 分类统计
- **isoflow**: 37 个图标
- **aws**: 320 个图标
- **gcp**: 217 个图标
- **azure**: 448 个图标
- **kubernetes**: 40 个图标

## 使用方法

### 1. 在代码中直接引用

```typescript
import isoflowIcon from './icons-export/isoflow/user.svg';

<img src={isoflowIcon} alt="user" />
```

### 2. 使用索引 JSON 文件

```typescript
import iconsIndex from './icons-export/icons-index.json';

// 按 ID 查找图标
const icon = iconsIndex.find(i => i.id === 'user');
console.log(icon.path); // => isoflow/user.svg
```

### 3. 按类别列出所有图标

```typescript
import iconsIndex from './icons-export/icons-index.json';

// 获取所有 AWS 图标
const awsIcons = iconsIndex.filter(i => i.category === 'aws');
```

## 文件大小
- 每个 SVG 文件通常在 1-10 KB
- 总文件大小约为 5-10 MB

## 更新图标

如需更新图标，请重新运行导出脚本：

```bash
npm run export:icons
```

---
生成时间: 2025/11/13 17:55:25
