# SpeakSmart AI

SpeakSmart AI 是一个英语口语练习应用，基于 `React + TypeScript + Vite + Capacitor` 开发。  
你可以通过文本输入或按住录音输入英文句子，应用会调用模型服务完成语句分析，并将内容自动加入复习与历史库。

## 核心能力

- 英文句子分析：纠错、优化表达、中文翻译、相似例句
- 双输入方式：文本输入 + 长按录音（松开发送，上滑取消）
- 三大页面：`Practice`、`Review`、`History`
- 复习机制：基于简化 SRS 的到期复习 + 今日兜底复习
- 数据管理：历史搜索、展开详情、编辑、删除、JSON 导入导出
- 跨端支持：Web 运行 + Android 打包（Capacitor）

## 技术栈

- 前端框架：React 18、TypeScript、Vite 5
- 样式与图标：Tailwind CSS、lucide-react
- 跨端容器：Capacitor 6（Android）
- 网络层：
  - Web：`fetch`
  - Native：`CapacitorHttp`
- 本地存储：`localStorage`

## 页面说明

### Practice

- 输入英文句子并发送，调用 AI 返回分析结果
- 支持长按录音后语音转文本，再自动进入分析流程
- 长按消息气泡可执行 `Edit & Resend` / `Delete`
- 页面内包含 `Settings` 配置入口

### Review

- 按到期队列展示复习卡片（中文提示 -> 点击显示英文答案）
- 提供 `Forgotten / Easy` 两种反馈
- 当无到期内容时可点 `Check Again`，回顾当天新增内容

### History

- 按日期分组展示历史练习记录
- 支持关键词搜索（原句 / 翻译 / 修正句）
- 支持记录编辑、删除，以及 JSON 备份导入导出

## 请求与配置机制

### AI 分析（文本）

- 默认模型：`doubao-1-5-pro-32k-250115`
- 默认基地址：
  - Web：`/api/v3`（由 Vite 代理到火山方舟）
  - Native：`https://ark.cn-beijing.volces.com/api/v3`
- API 路径：`/chat/completions`
- 当自定义模型返回 404 时，会自动回退到默认模型

### ASR 转写（语音）

- 默认模型：`bigmodel`
- 失败兜底模型：`doubao-seed-2-0-mini-260428`（仅在默认模型不可用时触发）
- 默认基地址策略与 AI 一致（Web 走 `/api/v3` 代理，Native 走完整地址）
- API 路径：`/chat/completions`
- 前端会将录音转换为可识别的音频载荷后再发起请求

### 应用内设置项

在 `Practice -> Settings` 中配置并保存：

- `API Key`（必填）
- `AI Base URL`（可选）
- `AI Model ID`（可选）
- `ASR Base URL`（可选）
- `ASR Model`（可选）

说明：

- 设置持久化在 `localStorage`（键名：`speaksmart_settings`）
- `.env` 中不再读取运行时 API Key（见 `.env.example`）

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

默认地址通常为 [http://localhost:5173](http://localhost:5173)。

### 生产构建

```bash
npm run build
```

构建产物输出到 `dist/`。

## NPM 脚本

- `npm run dev`：启动 Vite 开发服务器
- `npm run build`：执行 TypeScript 检查并构建
- `npm run preview`：本地预览构建产物
- `npm run cap:sync`：构建并同步到 Android 工程
- `npm run cap:open`：使用 Android Studio 打开工程

## Android 流程

```bash
npm run cap:sync
npm run cap:open
```

随后在 Android Studio 中运行或打包 APK。

## 数据与隐私

- 练习数据默认保存在本地 `localStorage`（键名：`speaksmart_entries`）
- API 请求会发送至你在设置中配置的服务端地址
- API Key 存储在本地设备，请仅在可信设备上使用

## 项目结构

```text
.
├─ App.tsx
├─ index.tsx
├─ components/
│  ├─ InputView.tsx
│  ├─ ReviewView.tsx
│  └─ DatabaseView.tsx
├─ services/
│  ├─ geminiService.ts
│  ├─ asrService.ts
│  └─ storageService.ts
├─ types.ts
├─ vite.config.ts
├─ capacitor.config.json
└─ android/
```

## 常见问题

### API Key 报错或请求失败

- 先确认 `Settings` 中 `API Key` 已保存
- 检查 `AI Base URL / ASR Base URL` 是否可达
- Web 端使用 `/api/v3` 时，确保本地开发服务处于运行状态

### 麦克风不可用

- 检查浏览器是否已授予麦克风权限
- 建议使用 Chrome / Edge 最新版本
- 非 `localhost` 场景通常需要 HTTPS

### Android 页面未更新

- 执行 `npm run cap:sync` 后重新运行 App
- 必要时在 Android Studio 中 Clean / Rebuild

## License

当前仓库未声明开源许可证，如需开源请补充 `LICENSE` 文件。
