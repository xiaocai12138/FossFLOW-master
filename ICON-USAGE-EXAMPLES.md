# FossFLOW 图标加载系统使用示例

本文档展示如何在 FossFLOW 中使用新的文件系统图标加载器。

## 基础用法

### 1. 加载所有图标

```typescript
import * as iconLoader from './services/iconFileSystemLoader';

async function loadAllIcons() {
  const allIcons = await iconLoader.loadAllIconPacks();
  console.log(`已加载 ${allIcons.length} 个图标`);
  allIcons.forEach(icon => {
    console.log(`${icon.name} (${icon.collection})`);
  });
}
```

### 2. 加载特定分类的图标

```typescript
// 只加载 AWS 图标
const awsIcons = await iconLoader.loadIconPack('aws');
console.log(`AWS 图标数: ${awsIcons.length}`);

// 加载核心图标（快速初始化）
const coreIcons = await iconLoader.loadCoreIcons();
```

### 3. 查找单个图标

```typescript
const lambda = await iconLoader.findIconById('lambda');
if (lambda) {
  console.log(`图标: ${lambda.name}`);
  console.log(`URL: ${lambda.url}`);
  // 在 img 标签中使用
  const img = document.createElement('img');
  img.src = lambda.url;
  img.alt = lambda.name;
  document.body.appendChild(img);
}
```

### 4. 搜索图标

```typescript
// 搜索包含 'database' 的图标
const results = await iconLoader.searchIcons('database');
console.log(`找到 ${results.length} 个图标`);

// 结果示例
// [
//   { id: 'dynamodb', name: 'DynamoDB', url: '/icons-export/aws/dynamodb.svg', collection: 'aws' },
//   { id: 'rds', name: 'RDS', url: '/icons-export/aws/rds.svg', collection: 'aws' },
//   ...
// ]
```

## React 组件中的使用

### 例子 1: 图标库组件

```typescript
import { useEffect, useState } from 'react';
import * as iconLoader from './services/iconFileSystemLoader';

export function IconGallery() {
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadIcons = async () => {
      try {
        const allIcons = await iconLoader.loadAllIconPacks();
        setIcons(allIcons);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadIcons();
  }, []);

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;

  return (
    <div>
      <h2>图标库 ({icons.length} 个)</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: '10px'
      }}>
        {icons.map(icon => (
          <div key={icon.id} style={{ textAlign: 'center' }}>
            <img 
              src={icon.url}
              alt={icon.name}
              style={{ width: '64px', height: '64px' }}
            />
            <p style={{ fontSize: '12px' }}>{icon.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 例子 2: 使用 useIconPackManager Hook

```typescript
import { useIconPackManager } from './services/iconPackManagerV2';

export function IconPackManager() {
  const {
    lazyLoadingEnabled,
    enabledPacks,
    packInfo,
    loadedIcons,
    togglePack,
    toggleLazyLoading,
    loadAllPacks
  } = useIconPackManager();

  return (
    <div>
      <h3>图标包管理</h3>

      {/* 懒加载开关 */}
      <label>
        <input
          type="checkbox"
          checked={lazyLoadingEnabled}
          onChange={(e) => toggleLazyLoading(e.target.checked)}
        />
        启用懒加载
      </label>

      {/* 已启用的包 */}
      <h4>已启用的包 ({enabledPacks.length})</h4>
      <ul>
        {enabledPacks.map(packName => {
          const info = packInfo[packName];
          return (
            <li key={packName}>
              <span>{info?.displayName}</span>
              {info?.loading && <span> (加载中...)</span>}
              {info?.loaded && <span> ({info?.iconCount} 个)</span>}
              {packName !== 'isoflow' && (
                <button onClick={() => togglePack(packName, false)}>
                  禁用
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* 加载所有包 */}
      <button onClick={loadAllPacks}>加载所有图标包</button>

      <p>总计: {loadedIcons.length} 个图标</p>
    </div>
  );
}
```

### 例子 3: 自定义 Icon 组件

```typescript
import { useEffect, useState } from 'react';
import * as iconLoader from './services/iconFileSystemLoader';

interface IconProps {
  iconId: string;
  size?: number;
  className?: string;
}

export function Icon({ iconId, size = 32, className }: IconProps) {
  const [icon, setIcon] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadIcon = async () => {
      try {
        const foundIcon = await iconLoader.findIconById(iconId);
        if (foundIcon) {
          setIcon(foundIcon);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
      }
    };

    loadIcon();
  }, [iconId]);

  if (error) {
    return <span style={{ color: 'red' }}>未找到</span>;
  }

  if (!icon) {
    return <span>加载中...</span>;
  }

  return (
    <img
      src={icon.url}
      alt={icon.name}
      style={{ width: size, height: size }}
      className={className}
      title={icon.name}
    />
  );
}

// 使用示例
export function MyDiagram() {
  return (
    <div>
      <Icon iconId="lambda" size={48} />
      <Icon iconId="s3" size={48} />
      <Icon iconId="dynamodb" size={48} />
    </div>
  );
}
```

### 例子 4: 图标搜索器

```typescript
import { useState } from 'react';
import * as iconLoader from './services/iconFileSystemLoader';

export function IconSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e) => {
    const q = e.target.value;
    setQuery(q);

    if (q.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const icons = await iconLoader.searchIcons(q);
      setResults(icons);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="搜索图标..."
        value={query}
        onChange={handleSearch}
      />
      {searching && <p>搜索中...</p>}
      <p>找到 {results.length} 个结果</p>
      <ul>
        {results.slice(0, 20).map(icon => (
          <li key={icon.id}>
            {icon.name} ({icon.collection})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 例子 5: 图表自动加载所需图标

```typescript
import { useEffect, useState } from 'react';
import { useIconPackManager } from './services/iconPackManagerV2';

export function DiagramViewer({ diagramItems }) {
  const { loadPacksForDiagram, loadedIcons } = useIconPackManager();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadRequired = async () => {
      // 自动检测和加载图表需要的图标包
      await loadPacksForDiagram(diagramItems);
      setReady(true);
    };

    loadRequired();
  }, [diagramItems, loadPacksForDiagram]);

  if (!ready) {
    return <div>准备资源中...</div>;
  }

  return (
    <div>
      <p>已加载 {loadedIcons.length} 个图标</p>
      {/* 呈现图表 */}
    </div>
  );
}
```

## 高级用法

### 批量操作

```typescript
// 加载多个分类
async function loadMultiplePacks() {
  const results = await Promise.all([
    iconLoader.loadIconPack('aws'),
    iconLoader.loadIconPack('gcp'),
    iconLoader.loadIconPack('azure')
  ]);
  return results.flat();
}

// 搜索多个关键词
async function searchMultiple() {
  const results = await Promise.all([
    iconLoader.searchIcons('lambda'),
    iconLoader.searchIcons('database'),
    iconLoader.searchIcons('storage')
  ]);
  return results.flat();
}
```

### 缓存管理

```typescript
// 获取统计信息
const stats = await iconLoader.getIconPackStats();
console.log(stats);
// 输出: { isoflow: 37, aws: 320, gcp: 217, azure: 448, kubernetes: 40 }

// 清除缓存
iconLoader.clearIconCache();

// 重新加载图标
const freshIcons = await iconLoader.loadIconPack('aws');
```

### 性能优化

```typescript
// 监测加载性能
console.time('Load all icons');
const allIcons = await iconLoader.loadAllIconPacks();
console.timeEnd('Load all icons');
// 输出: Load all icons: 1234ms

// 预加载常用图标
async function preloadCommonIcons() {
  // 应用启动时加载核心图标
  const coreIcons = await iconLoader.loadCoreIcons();
  
  // 根据用户选择延迟加载其他包
  setTimeout(() => {
    iconLoader.loadIconPack('aws');
  }, 2000);
}
```

## 错误处理

```typescript
async function safeLoadIcons() {
  try {
    const icons = await iconLoader.loadAllIconPacks();
    return icons;
  } catch (error) {
    if (error instanceof TypeError) {
      console.error('网络错误，无法加载图标文件');
    } else if (error instanceof SyntaxError) {
      console.error('图标索引文件格式错误');
    } else {
      console.error('未知错误:', error);
    }
    return [];
  }
}
```

## 常见问题

### Q: 图标 URL 是什么格式？

A: 相对路径格式，例如：
- `/icons-export/aws/lambda.svg`
- `/icons-export/gcp/dataflow.svg`

### Q: 如何在不支持网络的环境中使用？

A: 图标需要通过 HTTP 请求加载，需要正常的网络连接。

### Q: 性能如何？

A: 
- 首次加载可能需要几秒（取决于网络）
- 之后会缓存，速度很快
- 建议使用懒加载以加快启动速度

### Q: 可以离线使用吗？

A: 可以，条件是：
1. 首先在线加载图标，填充缓存
2. 然后在离线时使用缓存的数据
3. 注意：离线时无法加载新的图标

## 性能对比

| 方法 | 初始加载 | 内存占用 | 更新难度 |
|------|---------|---------|---------|
| NPM 包 | 快（内联） | 大（全部加载） | 难（需重新编译） |
| 文件系统 | 中（网络请求） | 小（按需加载） | 易（直接修改文件） |
| 文件系统 + 懒加载 | 最快（仅核心） | 很小 | 易 |

## 相关文件

- **加载器**: `packages/fossflow-app/src/services/iconFileSystemLoader.ts`
- **管理器**: `packages/fossflow-app/src/services/iconPackManagerV2.ts`
- **完整指南**: `ICON-MANAGEMENT-GUIDE.md`
