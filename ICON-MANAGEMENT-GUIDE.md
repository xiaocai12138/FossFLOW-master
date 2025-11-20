# FossFLOW 图标管理指南

## 概述

FossFLOW 现已改用**文件系统加载图标**，而不是从 NPM 包导入。这使得图标管理更加灵活，支持以下功能：

- 📁 按文件夹分组管理图标
- 🔄 无需重新编译，直接更新 SVG 文件即可生效
- 🚀 按需加载（Lazy Loading），加快应用启动速度
- 📊 完整的图标索引和搜索功能

## 项目结构

```
FossFLOW-master/
├── icons-export/                 # 图标文件根目录
│   ├── isoflow/                 # 核心图标（37个）
│   │   ├── block.svg
│   │   ├── cloud.svg
│   │   └── ...
│   ├── aws/                     # AWS 服务图标（320个）
│   │   ├── lambda.svg
│   │   ├── dynamodb.svg
│   │   └── ...
│   ├── gcp/                     # Google Cloud 图标（217个）
│   ├── azure/                   # Microsoft Azure 图标（448个）
│   ├── kubernetes/              # Kubernetes 图标（40个）
│   ├── icons-index.json         # 图标索引文件（用于快速查询）
│   ├── icons-index.csv          # CSV 格式索引（方便查看）
│   └── README.md                # 图标说明文档
└── packages/fossflow-app/src/services/
    ├── iconFileSystemLoader.ts  # 文件系统加载器（核心模块）
    └── iconPackManagerV2.ts     # 图标包管理器
```

## 核心模块说明

### 1. iconFileSystemLoader.ts

这是新的图标加载系统的核心，提供以下功能：

#### 主要方法

```typescript
// 加载图标索引（所有图标的元数据）
loadIconIndex(): Promise<IconIndex[]>

// 加载特定分类的图标
loadIconPack(packName: 'isoflow' | 'aws' | 'gcp' | 'azure' | 'kubernetes'): Promise<Icon[]>

// 加载所有图标
loadAllIconPacks(): Promise<Icon[]>

// 加载核心图标（快速初始化）
loadCoreIcons(): Promise<Icon[]>

// 按 ID 查找单个图标
findIconById(iconId: string): Promise<Icon | null>

// 搜索图标
searchIcons(query: string): Promise<Icon[]>

// 获取统计信息
getIconPackStats(): Promise<Record<IconPackName, number>>

// 清除缓存
clearIconCache(): void
```

#### 缓存机制

- **索引缓存**: 将 `icons-export/icons-index.json` 缓存在内存中
- **图标缓存**: 已加载的图标对象缓存，避免重复解析

### 2. iconPackManagerV2.ts

React Hook，管理图标包的加载状态。

#### 使用示例

```typescript
import { useIconPackManager } from './services/iconPackManagerV2';

function MyComponent() {
  const iconPackManager = useIconPackManager();
  
  // 已加载的图标
  console.log(iconPackManager.loadedIcons);
  
  // 启用/禁用图标包
  await iconPackManager.togglePack('aws', true);
  
  // 获取包信息
  console.log(iconPackManager.packInfo);
  
  // 根据图表自动加载需要的包
  await iconPackManager.loadPacksForDiagram(diagramItems);
}
```

## 如何更新/添加图标

### 场景 1: 更新现有图标

假设你要更新 AWS Lambda 图标：

1. **编辑 SVG 文件**
   ```bash
   # 直接编辑现有文件
   icons-export/aws/lambda.svg
   ```

2. **保存文件**
   - 应用自动检测文件变化
   - 下次加载时使用最新版本

3. **清除浏览器缓存**（可选）
   ```javascript
   // 在浏览器控制台运行
   localStorage.removeItem('fossflow-lazy-loading-enabled');
   localStorage.removeItem('fossflow-enabled-icon-packs');
   location.reload();
   ```

### 场景 2: 添加新的图标

假设你要为 AWS 添加一个新图标 `opensearch.svg`：

1. **创建 SVG 文件**
   ```bash
   # 将 opensearch.svg 放在对应分类文件夹
   icons-export/aws/opensearch.svg
   ```

2. **更新索引**
   ```bash
   # 重新运行导出脚本以更新索引文件
   npm run export:icons
   ```

3. **验证**
   - 检查 `icons-export/icons-index.json` 是否包含新图标
   - 检查 `icons-export/icons-index.csv` 是否有新条目

### 场景 3: 添加新的分类

假设你要添加一个新的云服务提供商 `alibaba`：

1. **创建分类文件夹**
   ```bash
   mkdir icons-export/alibaba
   ```

2. **添加 SVG 文件**
   ```bash
   icons-export/alibaba/
   ├── ecs.svg
   ├── oss.svg
   └── ...
   ```

3. **更新索引**
   ```bash
   npm run export:icons
   ```

4. **在代码中注册新分类**（如需要）
   
   修改 `iconPackManagerV2.ts`:
   ```typescript
   export type IconPackName = 'isoflow' | 'aws' | 'gcp' | 'azure' | 'kubernetes' | 'alibaba';
   
   const PACK_METADATA: Record<IconPackName, string> = {
     // ...
     alibaba: 'Alibaba Cloud Icons'
   };
   
   // 在 loadAllPacks 中添加新分类
   const allPacks: IconPackName[] = ['isoflow', 'aws', 'gcp', 'azure', 'kubernetes', 'alibaba'];
   ```

## 图标索引文件格式

### icons-index.json

```json
[
  {
    "id": "lambda",
    "name": "Lambda",
    "category": "aws",
    "path": "aws/lambda.svg"
  },
  {
    "id": "dynamodb",
    "name": "DynamoDB",
    "category": "aws",
    "path": "aws/dynamodb.svg"
  }
]
```

### icons-index.csv

```csv
ID,Name,Category,Path
"lambda","Lambda","aws","aws/lambda.svg"
"dynamodb","DynamoDB","aws","aws/dynamodb.svg"
```

## 文件大小和性能

### 典型数据

| 分类 | 图标数 | 大小 |
|------|--------|------|
| isoflow | 37 | ~200 KB |
| aws | 320 | ~2 MB |
| gcp | 217 | ~1.2 MB |
| azure | 448 | ~2.5 MB |
| kubernetes | 40 | ~300 KB |
| **总计** | **1062** | **~6.2 MB** |

### 性能优化

1. **按需加载** - 默认仅加载 isoflow 核心图标
2. **缓存机制** - 已加载的图标缓存在内存中
3. **索引优化** - 图标索引使用 JSON 格式，快速解析

## SVG 文件要求

为了保证图标在 FossFLOW 中正常显示，建议遵循以下规范：

### 1. 文件格式

- **格式**: SVG（可缩放矢量图形）
- **颜色**: 支持 RGB 和 RGBA
- **尺寸**: 建议 64x64px ~ 512x512px

### 2. 文件命名

```
# 规范命名
λ lambda.svg          ✓ 好
aws-lambda.svg        ✓ 可接受
awslambda.svg         ✓ 可接受
AWS_Lambda.svg        ✗ 避免使用大写和下划线
```

### 3. SVG 结构

```svg
<!-- 推荐的最小 SVG 结构 -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- 使用 viewBox 以支持任意尺寸 -->
  <g>
    <!-- 图标内容 -->
  </g>
</svg>
```

### 4. 文件大小

- 建议单个文件 < 50 KB
- 优化工具: [SVGO](https://github.com/svg/svgo)

```bash
# 安装 SVGO
npm install -g svgo

# 优化 SVG 文件
svgo icons-export/aws/lambda.svg
```

## API 参考

### Icon 接口

```typescript
interface Icon {
  id: string;              // 唯一标识符
  name: string;            // 显示名称
  url: string;             // 相对路径（/icons-export/...）
  collection: IconPackName; // 分类
  isIsometric?: boolean;   // 是否为等距投影风格
}
```

### IconIndex 接口

```typescript
interface IconIndex {
  id: string;              // 图标 ID
  name: string;            // 图标名称
  category: IconPackName;  // 分类
  path: string;            // 相对路径
}
```

## 故障排除

### 问题 1: 新添加的图标不显示

**解决方案**:
1. 确保文件在正确的文件夹中
2. 运行 `npm run export:icons` 更新索引
3. 清除浏览器缓存: `Ctrl+Shift+Delete`
4. 硬刷新页面: `Ctrl+Shift+R`

### 问题 2: 图标索引加载失败

**原因**: 可能是 `icons-export` 文件夹未被正确部署

**解决方案**:
1. 检查 `icons-export` 文件夹是否在 `public` 目录中
2. 或在构建配置中添加复制规则
3. 检查浏览器控制台的 Network 标签，查看 `icons-index.json` 的加载状态

### 问题 3: 图标显示不清晰

**原因**: SVG 可能未正确优化

**解决方案**:
1. 使用 SVGO 优化 SVG 文件
2. 检查 viewBox 是否正确设置
3. 确保图标使用向量路径，而不是位图

## 迁移指南（从 NPM 包到文件系统）

如果你有自定义的图标包，可以按以下步骤迁移：

### 步骤 1: 导出现有图标

```typescript
// 从 NPM 包中导出图标
import myCustomPack from 'my-custom-icons-pack';
import { flattenCollections } from '@isoflow/isopacks/dist/utils';

const icons = flattenCollections([myCustomPack]);

// 保存为 JSON
icons.forEach(icon => {
  // 解析 base64 SVG 并保存为文件
  const svg = atob(icon.url.split(',')[1]);
  fs.writeFileSync(`icons-export/custom/${icon.id}.svg`, svg);
});
```

### 步骤 2: 更新索引

```bash
npm run export:icons
```

### 步骤 3: 更新代码

```typescript
// 旧方式
import customPack from 'my-custom-icons-pack';

// 新方式
import * as iconLoader from './services/iconFileSystemLoader';

const customIcons = await iconLoader.loadIconPack('custom');
```

## 最佳实践

### 1. 保持分类清晰

```
icons-export/
├── isoflow/           # 通用图标
├── aws/               # AWS 专用
├── custom/            # 自定义图标
└── ...
```

### 2. 使用语义化命名

```
✓ ec2.svg
✓ s3.svg
✓ cloudfront.svg
✗ 1.svg
✗ icon_aws.svg
```

### 3. 定期优化

```bash
# 使用 SVGO 批量优化
find icons-export -name "*.svg" -exec svgo {} \;
```

### 4. 版本控制

```bash
# 跟踪图标变更
git add icons-export/
git commit -m "Update AWS icons pack"
```

## 开发建议

### 本地开发

```bash
# 开发模式下查看图标变化
npm run dev

# 编辑 SVG 文件后，刷新浏览器查看效果
# 清除缓存的图标
localStorage.removeItem('fossflow-last-opened-data');
location.reload();
```

### 性能测试

```typescript
// 在浏览器控制台测试图标加载性能
import * as loader from './services/iconFileSystemLoader';

console.time('Load all icons');
const icons = await loader.loadAllIconPacks();
console.timeEnd('Load all icons');

// 输出: Load all icons: 1234ms
```

## 贡献指南

如果你想贡献新的图标集：

1. 创建新的分类文件夹
2. 添加优化后的 SVG 文件
3. 运行 `npm run export:icons`
4. 提交 Pull Request

## 常见问题

**Q: 可以在运行时添加新的图标分类吗？**

A: 可以。编辑 `iconPackManagerV2.ts` 中的 `IconPackName` 类型和 `PACK_METADATA`，然后运行 `npm run export:icons` 重新生成索引。

**Q: 图标加载速度与 NPM 包方式相比如何？**

A: 文件系统加载可能略慢（额外的网络请求），但通过缓存和按需加载，整体性能相当或更优。

**Q: 如何备份图标？**

A: 整个 `icons-export` 文件夹都已版本控制，直接 git push 即可。

---

**最后更新**: 2025年11月20日

**相关文件**:
- 图标加载器: `packages/fossflow-app/src/services/iconFileSystemLoader.ts`
- 图标管理: `packages/fossflow-app/src/services/iconPackManagerV2.ts`
- 导出脚本: `scripts/export-icons.js`
