# NEXA 曜屏 · Vue UI 还原版

AI 驱动的智慧大屏低代码平台前端。本阶段目标：**按 UI 设计稿还原项目页面**，使用 Vue 3 + Pinia + Vue Router + ECharts。

## 启动

```bash
pnpm install
pnpm dev:web
```

打开：<http://127.0.0.1:5173>

当前环境已经启动了一个开发服务器，可直接访问：

- 登录：<http://127.0.0.1:5173/login>
- 注册：<http://127.0.0.1:5173/login?mode=register>
- 工作台：<http://127.0.0.1:5173/home>
- 数据源：<http://127.0.0.1:5173/data-sources>
- 编辑器 · AI 面板：<http://127.0.0.1:5173/editor/demo?panel=ai>
- 编辑器 · 属性面板：<http://127.0.0.1:5173/editor/demo?panel=props>
- GeoJSON 上传弹窗：<http://127.0.0.1:5173/editor/demo?panel=ai&modal=geo>
- 全屏预览：<http://127.0.0.1:5173/preview/demo>

## 已还原页面

| 页面 | 路由 | 对应设计稿 |
|---|---|---|
| 登录 | `/login` | `ui/screens/01-login.png` |
| 注册 | `/login?mode=register` | `ui/screens/02-register.png` |
| 工作台 | `/home` | `ui/screens/03-home.png` |
| 新建画布弹窗 | `/home?modal=new` | `ui/screens/04-new-canvas.png` |
| 数据源 | `/data-sources` | `ui/screens/05-data-sources.png` |
| 编辑器 · AI | `/editor/demo?panel=ai` | `ui/screens/06-editor-ai.png` |
| 编辑器 · 属性 | `/editor/demo?panel=props` | `ui/screens/07-editor-properties.png` |
| GeoJSON 上传 | `/editor/demo?panel=ai&modal=geo` | `ui/screens/08-geojson-upload.png` |
| 全屏预览 | `/preview/demo` | `ui/screens/09-preview.png` |

实现后的验收截图位于 `ui/screens/app-*.png`。

## 已实现的交互

- 登录 / 注册切换、演示账号进入、登录后回跳；
- 工作台搜索草稿、新建画布弹窗、空白/模板选项；
- 数据源列表、行选中、测试请求状态更新、保存提示；
- 编辑器 AI/属性面板切换、左右面板收起、缩放控件、预览跳转；
- GeoJSON 上传弹窗；
- 预览页自适应缩放、ESC 退出；
- ECharts 折线、环形、地图与迷你图表；
- 全站 Toast 反馈。

## 当前边界

- 账号、项目、数据源使用 **本地 mock 会话与 mock 数据**，尚未接后端；
- 登录页默认带演示会话，方便直接浏览；真实接入时把 `apps/web/src/stores/auth.ts` 中初始 `user` 改回 `null`；
- 画布目前是 **UI 还原态**：选中框、缩放控件、面板切换已实现，Moveable 拖拽/缩放/框选引擎尚未接入；
- AI 面板为演示交互，不调用真实模型；
- 数据源“上次通过 / 未测试”代表最近一次浏览器测试结果，不是持续连接。

## 技术结构

```text
apps/web/src/
├── views/                 # Login / Home / DataSources / Editor / Preview
├── components/
│   ├── layout/            # Sidebar / TopBar
│   ├── home/              # DraftThumb / NewCanvasModal
│   ├── editor/            # ComponentLibrary / AIPanel / PropertyPanel / GeoJsonModal
│   ├── screen/            # DashboardScreen / EChart
│   └── ui/                # AppLogo / Icon / ToastHost
├── lib/                   # chartOptions / echarts / icons / toast
├── stores/                # auth
├── router/
└── styles/                # 设计稿对应的全局样式
```

## 相关文档

- [项目计划书](项目计划书.md)
- [UI 设计稿](ui/screens)
