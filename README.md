# SpeakSmart AI

SpeakSmart AI 是一个英语口语练习应用，基于 `React + TypeScript + Vite + Capacitor` 开发。
你可以通过文本输入或按住录音输入英文句子，应用会调用模型服务完成语句分析，并将内容自动加入复习与历史库。

## 核心能力

- **英文句子分析**：纠错、优化表达、中文翻译、相似例句。
- **双输入方式**：文本输入 + 长按录音（松开发送，上滑取消）。
- **智能语音合成 (TTS)**：支持单词/句子发音，具备**本地缓存机制**（IndexedDB），第二次播放秒开且不耗流量。
- **三大页面**：`Practice`（练习）、`Review`（复习）、`History`（历史）。
- **复习机制**：基于简化 SM-2 算法的到期复习 + 今日兜底复习。
- **数据管理**：历史搜索、展开详情、编辑、删除、JSON 导入导出。
- **跨端支持**：Web 运行 + Android 打包（Capacitor）。

## 技术栈

- **前端框架**：React 18、TypeScript、Vite 5
- **样式与图标**：Tailwind CSS、lucide-react
- **跨端容器**：Capacitor 6 (Android)
- **网络层**：
  - Web：`fetch`
  - Native：`CapacitorHttp`
- **本地存储**：`localStorage` (设置/条目) + `IndexedDB` (语音缓存)

## 页面说明

### Practice
- 输入英文句子并发送，调用 AI 返回分析结果。
- 支持长按录音后语音转文本，再自动进入分析流程。
- 长按消息气泡可执行 `Edit & Resend` / `Delete`。
- 页面内包含 `Settings` 配置入口。

### Review
- 按到期队列展示复习卡片（中文提示 -> 点击显示英文答案）。
- 提供 `Forgotten / Easy` 两种反馈。
- 当无到期内容时可点 `Check Again`，回顾当天新增内容。

### History
- 按日期分组展示历史练习记录。
- 支持关键词搜索（原句 / 翻译 / 修正句）。
- 支持记录编辑、删除，以及 JSON 备份导入导出。

## 请求与配置机制

### AI 分析（文本）
- **默认模型**：`doubao-1-5-pro-32k-250115`
- **默认地址**：
  - Web：`/api/v3`（由 Vite 代理到火山方舟）
  - Native：`https://ark.cn-beijing.volces.com/api/v3`
- **API 路径**：`/chat/completions`

### ASR 转写（语音）
- **默认模型**：`bigmodel`
- **默认地址策略**：与 AI 一致。
- **API 路径**：`/chat/completions`

### TTS 语音合成
- **服务商**：火山引擎 (Volcengine)
- **协议**：基于 SSE 的流式接口（由本地代理转发）。
- **缓存**：使用 IndexedDB 存储音频 Blob，实现一次生成，永久本地播放。
- **配置**：需在设置中填写 `App ID` 和 `Access Token`。

## 应用内设置项

在 `Practice -> Settings` 中配置并保存：
- `API Key`：火山方舟 API Key（必填）。
- `TTS App ID`：火山引擎应用 ID。
- `TTS Access Token`：火山引擎访问令牌。
- `AI Base URL`：可选。
- `AI Model ID`：可选。

## 快速开始

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
- `npm run dev`：启动 Vite 开发服务器。
- `npm run build`：执行 TypeScript 检查并构建。
- `npm run cap:sync`：构建并同步到 Android 工程。
- `npm run cap:open`：使用 Android Studio 打开工程。

## 数据与隐私
- 练习数据默认保存在本地 `localStorage`。
- 语音数据缓存在本地 `IndexedDB`。
- API 请求会发送至你在设置中配置的服务端地址。
- API Key 存储在本地设备，请仅在可靠设备上使用。

## License
本项目采用 `MIT` 许可证开源，详见根目录 [LICENSE](./LICENSE) 文件。
