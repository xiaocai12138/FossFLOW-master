# FossFLOW 项目接手说明

这个仓库是一个用于绘制等距风格拓扑图/架构图的前端项目，当前采用 `monorepo` 结构，包含：

- 一个可复用的图形编辑器组件库 `fossflow-lib`
- 一个面向最终用户的应用壳 `fossflow-app`
- 一个可选的文件存储后端 `fossflow-backend`

这份 README 不是面向开源用户的宣传文档，而是我们后续继续改造这个项目时使用的内部接手说明。

## 1. 项目概览

### 当前能力

- 在画布上拖拽图标并生成等距拓扑图
- 节点、连接线、文本框、矩形区域等基础建模能力
- 多语言支持
- 本地存储与可选服务端存储
- 图标包加载与自定义图标导入
- 运行视图 / 只读探索模式

### 当前技术栈

- `React 18`
- `TypeScript`
- `RSBuild`：应用层开发与打包
- `Webpack`：底层图形库打包
- `Zustand`：状态管理
- `MUI` + `emotion`
- `Express`：可选后端

## 2. 仓库结构

```text
FossFLOW-master/
├─ packages/
│  ├─ fossflow-app/        # 最终运行的前端应用
│  ├─ fossflow-lib/        # 画图核心库
│  └─ fossflow-backend/    # 可选后端，提供图文件持久化接口
├─ icons-export/           # 图标资源导出目录
├─ scripts/                # 图标同步、版本等脚本
├─ docs/                   # 原项目多语言文档
├─ e2e-tests/              # 端到端测试
├─ .env.example
└─ package.json
```

## 3. 包职责说明

### `packages/fossflow-app`

这是我们日常最常接触的应用层。

主要职责：

- 组织页面与应用状态
- 管理图纸保存、加载、导出
- 管理图标包来源
- 切换编辑态 / 运行态
- 接入底层 `Isoflow` 组件

关键入口文件：

- [App.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/App.tsx)
- [index.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/index.tsx)
- [storageService.ts](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/services/storageService.ts)
- [iconPackManagerV2.ts](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/services/iconPackManagerV2.ts)
- [DiagramManager.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/components/DiagramManager.tsx)
- [TopologyRunView.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/components/TopologyRunView.tsx)

### `packages/fossflow-lib`

这是项目的核心编辑器引擎，负责真正的图元渲染、交互和状态变更。

主要职责：

- 渲染画布、节点、连接线、标签、文本框、矩形
- 管理交互模式，如拖拽、框选、连接、放置图标
- 维护 editor store / scene store / ui store
- 暴露 `Isoflow` 组件给应用层使用

关键入口文件：

- [Isoflow.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-lib/src/Isoflow.tsx)
- [index.ts](D:/Code/JS/FossFLOW-master/packages/fossflow-lib/src/index.ts)
- [config.ts](D:/Code/JS/FossFLOW-master/packages/fossflow-lib/src/config.ts)
- [modelStore.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-lib/src/stores/modelStore.tsx)
- [uiStateStore.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-lib/src/stores/uiStateStore.tsx)
- [Renderer.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-lib/src/components/Renderer/Renderer.tsx)

### `packages/fossflow-backend`

这是一个可选后端，不参与画图逻辑，只负责图数据的服务端持久化。

主要职责：

- 提供存储状态探测接口
- 列出图纸
- 读取图纸
- 保存图纸
- 删除图纸

关键入口文件：

- [server.js](D:/Code/JS/FossFLOW-master/packages/fossflow-backend/server.js)

## 4. 本地启动方式

### 环境要求

- `Node.js >= 18`
- `npm >= 9`

### 安装依赖

```bash
npm install
```

### 启动前端开发环境

```bash
npm run dev
```

默认访问地址：

- [http://localhost:3000](http://localhost:3000)

### 启动后端开发环境

```bash
npm run dev:backend
```

默认接口地址：

- [http://localhost:3001/api/storage/status](http://localhost:3001/api/storage/status)

### 构建命令

```bash
npm run build:lib
npm run build:app
npm run build
```

## 5. 存储机制

应用层有两套存储逻辑：

1. 服务端存储
2. 浏览器端存储

代码入口在 [storageService.ts](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/services/storageService.ts)。

当前策略是：

- 前端先探测 `/api/storage/status`
- 如果服务端可用，则读写后端接口
- 如果服务端不可用，则退回浏览器侧存储

后端配置参考 [.env.example](D:/Code/JS/FossFLOW-master/.env.example)：

```env
ENABLE_SERVER_STORAGE=true
ENABLE_GIT_BACKUP=false
STORAGE_PATH=/data/diagrams
BACKEND_PORT=3001
```

## 6. 代码阅读建议

如果我们后续要继续改造，建议按下面顺序看代码：

1. 先看 [App.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/App.tsx)
2. 再看 [Isoflow.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-lib/src/Isoflow.tsx)
3. 再看 `stores`、`interaction`、`components/Renderer`
4. 最后看应用层的图标、存储、运行视图扩展

这样能先理解“应用层怎么包库”，再理解“库内部如何驱动画布行为”。

## 7. 当前代码特征与注意事项

### 1. 应用层和底层库耦合度较高

`fossflow-app` 并不是非常轻的壳层，里面已经加入了图标同步、运行视图、存储切换等业务逻辑。后续如果我们要做平台化改造，可能需要继续拆边界。

### 2. 存在自定义扩展痕迹

从当前代码可以看到，仓库已经不完全是原版开源项目，至少增加了：

- 图标包管理增强
- `TopologyRunView` 运行态视图
- 服务端存储增强
- 一些节点控制与快捷操作改造

后续做功能梳理时，需要先区分：

- 原项目能力
- 当前仓库新增能力
- 我们下一步准备新增的能力

### 3. 存在编码/文案异常

部分文件里能看到中文乱码或特殊字符异常，后续改造时需要重点关注编码一致性，尤其是：

- [README.md](D:/Code/JS/FossFLOW-master/README.md)
- [App.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/App.tsx)
- [TopologyRunView.tsx](D:/Code/JS/FossFLOW-master/packages/fossflow-app/src/components/TopologyRunView.tsx)
- [config.ts](D:/Code/JS/FossFLOW-master/packages/fossflow-lib/src/config.ts)
- [server.js](D:/Code/JS/FossFLOW-master/packages/fossflow-backend/server.js)

### 4. 根目录当前不是干净工作区

仓库目前已经有未提交改动。后续我们在继续开发前，建议先确认：

- 哪些是已有在制改动
- 哪些是我们新增改动
- 是否需要单独开分支做下一阶段改造

## 8. 后续改造建议

从接手角度看，建议优先处理以下几件事：

### 第一阶段：整理与稳定

- 梳理现有功能边界
- 修复乱码和文案编码问题
- 补充一版统一的中英文命名规范
- 明确前端状态模型与图数据结构

### 第二阶段：做代码边界拆分

- 将应用层业务逻辑和底层编辑器能力分离清楚
- 将图标系统、存储系统、运行态能力拆成独立模块
- 减少 `App.tsx` 中的聚合逻辑

### 第三阶段：做业务化改造

- 接入我们的领域模型
- 接入我们自己的图元规范和图标体系
- 接入真实查询接口与运行态联动
- 统一保存、导入导出、版本兼容策略

## 9. 常用命令

```bash
npm run dev
npm run dev:backend
npm run dev:lib
npm run build
npm run build:lib
npm run build:app
npm run lint
npm test
```

## 10. 我们接下来建议怎么推进

建议下一步直接产出一份更具体的“改造清单”，至少覆盖：

- 现有模块拆分图
- 需要保留的能力
- 需要替换的能力
- 需要新增的能力
- 改造优先级与分期计划

如果后续继续在这个仓库上开发，这份 README 可以作为总入口，再补充：

- `docs/architecture.md`
- `docs/refactor-plan.md`
- `docs/data-model.md`
- `docs/icon-system.md`

---

维护说明：

- 当前 README 由接手分析后重写
- 目标是服务后续内部开发，而不是对外发布
- 如架构或目录发生变化，请优先更新本文件
