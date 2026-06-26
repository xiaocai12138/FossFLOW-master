# FossFLOW 代码目录审计

## 范围

本清单只覆盖可执行源码，排除以下噪音目录：

- `public/` 静态资源
- `__tests__/` 测试
- `src/i18n/` 与 `public/i18n/` 语言包
- `fixtures/`、`assets/`、`docs/` 示例与文档素材

审计时间：`2026-06-01`

## 总体结构

```text
packages/
  fossflow-app/      前端应用壳，负责页面、存储、运行视图、图标包装配
  fossflow-lib/      画布编辑引擎，负责渲染、交互、状态、菜单和控件
  fossflow-backend/  可选后端，负责图表文件存取
```

## 结论摘要

- 架构上是典型的 `App Shell + Library Engine + Optional Backend`。
- `fossflow-lib` 分层基本成立：`types / stores / hooks / interaction / components / utils`。
- `fossflow-app` 当前开始向页面级容器拆分，但还存在明显的“大页面组件”和“遗留未清理文件”。
- 当前主要不规范点：
  - 多处 `any` / `as any`
  - 中文乱码/编码污染
  - 超长组件与超长 hook
  - `window.alert / confirm / localStorage / sessionStorage` 直接散落在 UI 层
  - 一些遗留文件已基本失活但仍在目录中

## 目录与文件职责

### 1. `packages/fossflow-app/src`

| 文件 | 行数 | 职责 | 规范/约定判断 |
|---|---:|---|---|
| `App.tsx` | 9 | 应用入口，仅挂载 `EditorWorkspace` | 符合。入口保持极薄。 |
| `index.tsx` | 38 | React 启动、i18n 与根节点挂载 | 符合。 |
| `index.css` | 12 | 全局基础样式 | 符合。 |
| `App.css` | 166 | 编辑器页面与应用级样式 | 基本符合，但样式职责继续膨胀。 |
| `pages/EditorWorkspace.tsx` | 546 | 主编辑页容器，管理图表状态、会话保存、运行视图切换、自定义主菜单 | **不符合**。文件过大、职责过多、UI/持久化/菜单配置混合。 |
| `components/TopologyRunView.tsx` | 346 | 运行视图页面，承载 Trace 查询、运行态节点联动、右侧链路/日志信息 | **部分符合**。页面职责清晰，但组件偏大，mock 数据和视图耦合。 |
| `components/TopologyRunView.css` | 393 | 运行视图样式 | **部分符合**。样式文件过大，建议拆成 header/panel/canvas 三段。 |
| `components/EditorSessionDialogs.tsx` | 170 | 保存、加载、导出对话框 | 基本符合。属于“集中式对话框容器”。 |
| `components/DiagramManager.tsx` | 226 | 服务端/会话存储图表管理弹窗 | **部分不符合**。有明显乱码、英文残留、内联交互较重。 |
| `components/DiagramManager.css` | 202 | 图表管理弹窗样式 | 基本符合。 |
| `components/ErrorBoundary.tsx` | 108 | React 错误边界 | 符合。 |
| `components/ErrorBoundary.css` | 68 | 错误边界样式 | 符合。 |
| `components/ChangeLanguage/index.tsx` | 52 | 语言切换控件 | 符合。 |
| `components/ChangeLanguage/styles.css` | 41 | 语言切换样式 | 符合。 |
| `components/EditorActionMenu.tsx` | 141 | 旧的应用动作菜单组件 | **不符合**。当前基本未被使用，属于遗留文件。 |
| `StorageManager.tsx` | 178 | 本地存储占用弹窗 | **不符合**。大量内联样式，未接入统一设计体系。 |
| `services/storageService.ts` | 216 | 存储策略层，封装 `ServerStorage / SessionStorage / StorageManager` | 基本符合。这里用了策略模式，职责明确。 |
| `services/iconFileSystemLoader.ts` | 181 | 从本地导出目录读取图标包与索引 | 基本符合。 |
| `services/iconPackManager.ts` | 235 | 旧版图标包管理器 | **不符合**。与 V2 并存，疑似遗留。 |
| `services/iconPackManagerV2.ts` | 321 | 当前图标包管理 hook，负责来源选择、懒加载、按图自动补包 | **部分符合**。功能完整，但 hook 过大。 |
| `diagramUtils.ts` | 55 | 图表数据类型与轻量工具 | 符合。 |
| `types/editor.ts` | 11 | `SavedDiagram` 等编辑器侧类型 | 符合。 |
| `i18n.ts` | 62 | i18n 初始化 | 符合。 |
| `serviceWorkerRegistration.ts` | 100 | PWA service worker 注册 | 标准 CRA 风格。 |
| `reportWebVitals.ts` | 13 | Web Vitals 上报 | 标准模板文件。 |
| `usePersistedDiagram.ts` | 60 | 图表持久化 hook | **不符合**。当前未见实际引用，疑似遗留。 |

### 2. `packages/fossflow-backend`

| 文件 | 行数 | 职责 | 规范/约定判断 |
|---|---:|---|---|
| `server.js` | 217 | Express 文件存储服务，提供 `/api/storage/status` 和 `/api/diagrams` CRUD | **部分符合**。端点职责明确，但日志过多、错误处理和编码质量一般。 |

### 3. `packages/fossflow-lib/src`

#### 3.1 核心入口

| 文件 | 行数 | 职责 | 规范/约定判断 |
|---|---:|---|---|
| `Isoflow.tsx` | 131 | 画布引擎入口，组装 Provider、初始数据、UI 状态、运行态参数 | 符合。是较好的根组件。 |
| `index.ts` | 3 | 导出公开 API | 符合。 |
| `index.tsx` | 24 | 开发示例入口 | 符合。 |
| `index-docker.tsx` | 24 | Docker 示例入口 | 符合。 |
| `standaloneExports.ts` | 12 | 独立导出项 | 符合。 |

#### 3.2 状态与类型

| 目录/文件 | 行数 | 职责 | 规范/约定判断 |
|---|---:|---|---|
| `types/isoflowProps.ts` | 240 | `Isoflow` 输入参数定义 | 部分符合。类型较全，但体量偏大。 |
| `types/ui.ts` | 200 | UI 状态类型、菜单配置类型 | 部分符合。正在承载过多 UI 概念。 |
| `types/model.ts` / `scene.ts` / `common.ts` | 36~51 | 领域模型类型 | 符合。 |
| `stores/modelStore.tsx` | 168 | 模型状态仓库 | 符合。 |
| `stores/uiStateStore.tsx` | 159 | UI 状态仓库 | 符合。 |
| `stores/sceneStore.tsx` | 165 | 场景状态仓库 | 符合。 |
| `stores/localeStore.tsx` | 67 | 语言状态与翻译函数 | 符合。 |
| `stores/reducers/*` | 31~135 | 图元级 reducer，按 `view / connector / modelItem / rectangle / textBox` 分开 | 符合。典型 reducer 切分。 |

#### 3.3 Hook 与交互层

| 文件 | 行数 | 职责 | 规范/约定判断 |
|---|---:|---|---|
| `hooks/useScene.ts` | 499 | 画布场景核心 hook，管理投影、命中、可视边界、选中态等 | **不符合**。典型 God Hook。 |
| `interaction/useInteractionManager.ts` | 414 | 输入交互总调度，按模式分发鼠标事件 | **部分符合**。模式分发思路正确，但过长。 |
| `interaction/usePanHandlers.ts` | 203 | 平移相关手势处理 | 基本符合。 |
| `hooks/useInitialDataManager.ts` | 142 | 初始模型装载/清空 | 基本符合。 |
| `hooks/useHistory.ts` | 105 | 撤销/重做历史 | 符合。 |
| `hooks/useIsoProjection.ts` | 64 | 等距投影换算封装 | 符合。 |
| `hooks/useDiagramUtils.ts` | 47 | 图表辅助操作 | 符合。 |
| `hooks/useIcon*.ts*` | 25~40 | 图标过滤、分类、解析 | 符合。 |
| `hooks/useModelItem.ts` / `useRectangle.ts` / `useTextBox.ts` / `useViewItem.ts` | 11~14 | 细粒度 store 访问 hook | 符合。 |
| `interaction/modes/*` | 31~182 | 各交互模式：游标、框选、拖拽、连线、文本、矩形、运行态点击 | 符合。是明确的状态/模式拆分。 |

#### 3.4 UI 组件层

| 文件/目录 | 行数 | 职责 | 规范/约定判断 |
|---|---:|---|---|
| `components/UiOverlay/UiOverlay.tsx` | 259 | 全部浮层 UI 的装配点：菜单、缩放、对话框、帮助提示、右键菜单 | **部分不符合**。装配职责成立，但入口开始变重。 |
| `components/MainMenu/MainMenu.tsx` | 357 | 左上主菜单，承载内置动作与应用扩展动作 | **不符合**。菜单渲染、行为、样式决策耦合较重。 |
| `components/ToolMenu/ToolMenu.tsx` | 175 | 右上工具栏 | 基本符合。 |
| `components/ZoomControls/ZoomControls.tsx` | 120 | 缩放工具 | 符合。 |
| `components/ItemControls/ItemControlsManager.tsx` | 164 | 图元属性面板总入口，当前兼容左侧栏与居中浮窗 | **部分符合**。结构清楚，但分支较多。 |
| `components/ItemControls/NodeControls/*` | 134~215 | 节点属性编辑、图标快捷切换 | 基本符合。 |
| `components/ItemControls/ConnectorControls/ConnectorControls.tsx` | 407 | 连线属性编辑 | **不符合**。偏大。 |
| `components/ItemControls/IconSelectionControls/*` | 26~265 | 图标选择器与搜索 | 基本符合。 |
| `components/Renderer/Renderer.tsx` | 112 | 渲染器根组件 | 符合。 |
| `components/SceneLayers/*` | 15~310 | 节点、连线、文本、矩形等图层渲染 | 符合。分层合理。 |
| `components/TransformControlsManager/*` | 13~71 | 选中态控制锚点 | 符合。 |
| `components/ContextMenu/*` | 35~87 | 右键菜单 | 符合。 |
| `components/SettingsDialog.tsx` / `HelpDialog.tsx` / `ExportImageDialog.tsx` | 100 / 239 / 548 | 设置、帮助、导图对话框 | 设置与帮助基本符合；导图对话框过大。 |

#### 3.5 工具与算法层

| 文件 | 行数 | 职责 | 规范/约定判断 |
|---|---:|---|---|
| `utils/renderer.ts` | 703 | 投影、命中、边界、文字尺寸、连线路径等核心几何算法 | **不符合**。工具集过大，建议拆为 `projection / bounds / hit-testing / text / connectors`。 |
| `utils/exportOptions.ts` | 168 | 导出 JSON / 紧凑 JSON / 转换 | 基本符合。 |
| `utils/findNearestUnoccupiedTile.ts` | 120 | 找可放置 tile | 符合。 |
| `utils/common.ts` | 98 | 通用工具 | 基本符合。 |
| `utils/model.ts` / `connectorLabels.ts` / `pointInPolygon.ts` / `CoordsUtils.ts` / `pathfinder.ts` / `SizeUtils.ts` | 22~63 | 模型与几何辅助函数 | 符合。 |

## 设计模式与前端约定

### 已采用的模式

- **容器组件模式**：`EditorWorkspace.tsx`、`TopologyRunView.tsx`
- **策略模式**：`storageService.ts` 中 `ServerStorage / SessionStorage`
- **模式分发**：`interaction/modes/*` + `useInteractionManager.ts`
- **Store + Selector**：`modelStore / uiStateStore / sceneStore`
- **分层渲染**：`SceneLayers/*`

### 当前偏离点

- `EditorWorkspace.tsx` 仍是“页面容器 + 持久化 + 菜单组装 + 运行视图切换”的混合体
- `MainMenu.tsx` 与 `UiOverlay.tsx` 同时承担了装配和展示
- 运行视图仍是“页面 + mock 数据 + 行为逻辑”未拆分
- `StorageManager.tsx` 还没有进入统一组件体系，像独立小应用

## 函数规模与热点文件

### 需要优先重构的超大文件

| 文件 | 行数 | 问题 |
|---|---:|---|
| `pages/EditorWorkspace.tsx` | 546 | 页面容器过大，保存/加载/导出/运行视图切换集中在一起 |
| `components/TopologyRunView.tsx` | 346 | 页面与运行时 mock 逻辑耦合 |
| `components/TopologyRunView.css` | 393 | 样式集中度过高 |
| `components/MainMenu/MainMenu.tsx` | 357 | 菜单行为与视图未拆开 |
| `hooks/useScene.ts` | 499 | God Hook |
| `interaction/useInteractionManager.ts` | 414 | 输入分发器过长 |
| `utils/renderer.ts` | 703 | 算法大杂烩 |
| `components/ExportImageDialog/ExportImageDialog.tsx` | 548 | 对话框体量过大 |
| `components/ConnectorControls/ConnectorControls.tsx` | 407 | 表单逻辑偏重 |

### 关键函数/方法大小

> 这里只列有代表性的函数，不列所有小型展示函数。

- `EditorWorkspace.tsx`
  - `handleSaveDiagram`：约 `117` 行，过大
  - `handleExportDiagram`：约 `82` 行，偏大
  - `handleCreateNewDiagram`：约 `27` 行，可接受
  - 组件主函数本身：`546` 行，明显超标
- `TopologyRunView.tsx`
  - `applyRuntimeConnectorStyle`：约 `20` 行，合理
  - `handleTraceQuery`：约 `17` 行，合理
  - 组件主体 + 计算逻辑：集中在一个文件内，建议拆成 `useRuntimeTraceState`
- `storageService.ts`
  - `ServerStorage` / `SessionStorage` 各方法长度普遍可接受
  - `StorageManager.initialize` 很小，职责清晰
- `iconPackManagerV2.ts`
  - `useIconPackManager` 为主导函数，几乎吞掉整个文件，偏大
- `useScene.ts`
  - 单 hook 近 `500` 行，应拆子 hook
- `useInteractionManager.ts`
  - 单 hook 超 `400` 行，应拆模式注册与事件绑定
- `renderer.ts`
  - 单文件 `30+` 个导出函数，其中 `getItemAtTile`、`getVisualBounds`、`getProjectBounds`、`getConnectorPath` 较重

## 代码规范判断

### 符合的点

- 命名基本统一：`handleXxx`、`useXxx`、`*Manager`、`*Controls`
- `fossflow-lib` 的目录分层明确
- 大多数组件为单一导出，易于定位
- 状态管理使用 selector，避免全量订阅

### 不符合的点

- **类型质量不足**：`EditorWorkspace.tsx`、`DiagramManager.tsx`、`iconPackManagerV2.ts`、`storageService.ts` 中有明显 `any`
- **编码污染**：存在中文乱码与异常字符，集中在应用层和后端
- **遗留代码未清理**：
  - `components/EditorActionMenu.tsx`
  - `usePersistedDiagram.ts`
  - `services/iconPackManager.ts`
- **样式体系不统一**：
  - 应用层同时使用 `CSS 文件`、`内联样式`
  - 引擎层更多使用 `MUI sx`
- **浏览器 API 直连过多**：
  - `alert`
  - `confirm`
  - `localStorage`
  - `sessionStorage`
  - `window.location.reload`

## 改造优先级

1. 拆 `EditorWorkspace.tsx`
   - `useDiagramPersistence`
   - `useEditorMenuActions`
   - `useRuntimeMode`
2. 拆 `TopologyRunView.tsx`
   - `RuntimeTraceMenu`
   - `RuntimeMetrics`
   - `RuntimeSidePanel`
   - `useRuntimeTraceState`
3. 清理遗留文件
   - `EditorActionMenu.tsx`
   - `usePersistedDiagram.ts`
   - `iconPackManager.ts`
4. 拆 `useScene.ts` 与 `renderer.ts`
5. 统一应用层 UI 风格
   - 去掉 `StorageManager.tsx` 内联样式
   - 统一对话框和确认交互

## 建议的目录目标

```text
fossflow-app/src/
  pages/
  features/
    editor/
    runtime-trace/
    diagram-storage/
    icon-packs/
  components/
  hooks/
  services/
  types/
```

这个目标的核心不是“目录好看”，而是把当前页面组件里的状态机、持久化和视图拆回 feature 边界。
