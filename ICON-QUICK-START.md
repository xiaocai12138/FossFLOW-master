# FossFLOW 图标系统快速入门指南

## 🎯 5分钟快速上手

### 基础概念

FossFLOW 现在从文件系统加载图标，而不是从 NPM 包。这意味着：

- 📁 图标存储在 `icons-export/` 文件夹中
- 🚀 按需加载，提高启动速度
- ✏️ 直接修改 SVG 文件即可更新
- 🔄 无需重新编译和发布

### 项目结构

```
icons-export/
├── isoflow/       # ⭐ 核心图标（始终加载）
├── aws/           # AWS 服务图标
├── gcp/           # Google Cloud 图标
├── azure/         # Microsoft Azure 图标
├── kubernetes/    # Kubernetes 图标
└── icons-index.json  # 图标索引（用于快速查询）
```

## 📝 常见任务

### 任务 1: 更新现有图标

```bash
# 1. 编辑 SVG 文件
# 例如：更新 AWS Lambda 图标
vim icons-export/aws/lambda.svg

# 2. 保存文件
# ⚠️ 无需任何其他操作！

# 3. 刷新浏览器
# 访问 http://localhost:3000，按 Ctrl+Shift+R 硬刷新
```

**完成！** ✅ 新的图标会自动加载。

### 任务 2: 添加新图标

```bash
# 1. 将新的 SVG 文件放入对应的分类文件夹
cp my-new-icon.svg icons-export/aws/

# 2. 更新索引文件（生成 icons-index.json）
npm run export:icons

# 3. 验证索引已更新
cat icons-export/icons-index.json | grep my-new-icon

# 4. 提交更改
git add icons-export/
git commit -m "Add new AWS icon: my-new-icon"
git push
```

### 任务 3: 添加新的图标分类

假设要添加一个新的云提供商 "alibaba"：

```bash
# 1. 创建文件夹
mkdir icons-export/alibaba

# 2. 添加 SVG 文件
cp ecs.svg icons-export/alibaba/
cp oss.svg icons-export/alibaba/

# 3. 更新索引
npm run export:icons

# 4. 修改代码（可选）
# 编辑 packages/fossflow-app/src/services/iconPackManagerV2.ts
# 更新 IconPackName 类型：
# export type IconPackName = 'isoflow' | 'aws' | 'gcp' | 'azure' | 'kubernetes' | 'alibaba';

# 5. 重新编译
npm run build
```

## 🔧 开发指南

### 在本地开发

```bash
# 1. 启动开发服务器
npm run dev

# 2. 编辑 SVG 文件
vim icons-export/aws/lambda.svg

# 3. 刷新浏览器查看效果
# 如果文件改变不显示，清除缓存：
# localStorage.removeItem('fossflow-last-opened-data');
# location.reload();
```

### 部署到生产

```bash
# 1. 确保 icons-export 文件夹已添加到版本控制
git add icons-export/
git commit -m "Update icons"

# 2. 构建项目
npm run build

# 3. 部署 dist 文件（包括 icons-export 文件夹）
# 确保 icons-export 被部署到 web 服务器的 public 目录
```

## 📊 查看图标统计

```bash
# 查看每个分类的图标数量
cat icons-export/icons-index.csv | wc -l

# 查看特定分类的图标
grep ",aws," icons-export/icons-index.csv | head -20

# 查看 JSON 格式的索引
cat icons-export/icons-index.json | jq '.[] | select(.category == "aws") | .name'
```

## 🐛 故障排除

### 问题: 新添加的图标不显示

**解决方案:**

```bash
# 1. 确保文件在正确的位置
ls icons-export/aws/my-icon.svg

# 2. 运行导出脚本更新索引
npm run export:icons

# 3. 查看索引是否更新
grep "my-icon" icons-export/icons-index.json

# 4. 清除浏览器缓存
# - Ctrl+Shift+Delete 打开清除浏览器数据对话框
# - 选择"所有时间"并清除

# 5. 硬刷新浏览器
# Ctrl+Shift+R (Chrome/Firefox/Edge)
# Cmd+Shift+R (Mac)
```

### 问题: 图标索引加载失败

**原因:** `icons-export` 文件夹未被正确部署

**解决方案:**

```bash
# 1. 检查文件夹是否存在
ls -la dist/icons-export/

# 2. 检查构建配置
cat packages/fossflow-app/rsbuild.config.ts | grep icons

# 3. 手动复制文件
cp -r icons-export dist/

# 4. 检查浏览器网络标签
# F12 → Network → 搜索 "icons-index.json"
# 查看是否返回 404 或其他错误
```

### 问题: 图标显示不清晰

**原因:** SVG 文件可能未正确优化

**解决方案:**

```bash
# 1. 使用 SVGO 优化
npm install -g svgo
svgo icons-export/aws/lambda.svg

# 2. 检查 SVG 结构
cat icons-export/aws/lambda.svg

# 3. 确保使用了 viewBox
# 应该包含: <svg xmlns="..." viewBox="0 0 64 64">
```

## 💡 最佳实践

### ✅ 推荐做法

```bash
# 1. 使用语义化命名
mv icon1.svg lambda.svg
mv icon2.svg s3.svg

# 2. 定期优化 SVG 文件
find icons-export -name "*.svg" -exec svgo {} \;

# 3. 版本控制跟踪所有更改
git log --oneline icons-export/

# 4. 定期检查索引
npm run export:icons
```

### ❌ 避免做法

```bash
# ❌ 不要直接在浏览器中修改图标
# 原因: 浏览器会保存为 data URL，无法持久化

# ❌ 不要将 icons-export 添加到 .gitignore
# 原因: 图标是项目的重要资产

# ❌ 不要随意修改 icons-index.json
# 原因: 应该由 "npm run export:icons" 自动生成

# ❌ 不要忘记运行 "npm run export:icons"
# 原因: 新图标不会被索引，应用无法找到
```

## 📚 深入学习

- **完整管理指南**: 查看 [`ICON-MANAGEMENT-GUIDE.md`](./ICON-MANAGEMENT-GUIDE.md)
- **使用示例**: 查看 [`ICON-USAGE-EXAMPLES.md`](./ICON-USAGE-EXAMPLES.md)
- **升级详情**: 查看 [`ICON-SYSTEM-UPGRADE.md`](./ICON-SYSTEM-UPGRADE.md)

## 📞 获取帮助

1. 查看文档
2. 搜索已有 Issue
3. 提交新 Issue
4. 查阅源代码注释

## 🎓 学习路径

### 新手

1. 读这个文件 ✓
2. 尝试更新一个图标
3. 尝试添加一个新图标

### 中级

1. 阅读 `ICON-MANAGEMENT-GUIDE.md`
2. 了解 SVG 优化
3. 学习文件系统加载原理

### 高级

1. 研究 `iconFileSystemLoader.ts` 源代码
2. 自定义图标加载策略
3. 实现自定义图标提供商

---

**快速链接:**
- 📂 [图标文件夹](./icons-export)
- 📖 [完整指南](./ICON-MANAGEMENT-GUIDE.md)
- 🔗 [使用示例](./ICON-USAGE-EXAMPLES.md)
- 📝 [升级说明](./ICON-SYSTEM-UPGRADE.md)

**上次更新**: 2025年11月20日
