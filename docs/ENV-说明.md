# 环境变量说明（温故智学网）

本文档列出**前端（Vite）**与 **AI 代理后端（server）** 使用的环境变量，便于对照部署。**请勿把真实密钥提交到 Git**；示例值仅作格式参考。

---

## 一、前端（项目根目录 `.env`）

构建与开发时由 Vite 读取；**不要**在前端 `.env` 中存放 `DEEPSEEK_API_KEY`（会打进浏览器包）。

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `VITE_AI_API_BASE` | 生产必填 | AI 代理的 **OpenAI 兼容前缀**，需以 `/v1` 结尾、无尾部斜杠。例如：`https://api.你的域名.com/v1` 或本地 `http://127.0.0.1:8787/v1`。 |
| `VITE_DEEPSEEK_MODEL_DEFAULT` | 否 | 默认模型（Flash 档），用于测验干扰项、解答、雷达等。默认 `deepseek-v4-flash`。 |
| `VITE_DEEPSEEK_MODEL_HEAVY` | 否 | 长文生成模型（Pro 档），用于思维导图、资料讲义。默认 `deepseek-v4-pro`。 |
| （开发可选） | — | 开发时若不设置 `VITE_AI_API_BASE`，请求会走 Vite 代理路径 `/api/ai/...`，转发到本机 `server`（默认端口见下）。 |

**已废弃（请删除）**

| 变量名 | 说明 |
|--------|------|
| `VITE_DEEPSEEK_API_KEY` | 已迁移到服务端，勿再使用。 |
| `VITE_DEEPSEEK_BASE_URL` | 已由 `VITE_AI_API_BASE` + 独立后端替代。 |

---

## 二、AI 代理后端（`server/.env`）

单独部署时使用；密钥**只存在这里**。

> **常见错误**：只在 `server/.env.example` 里填了 `DEEPSEEK_API_KEY` —— **无效**。必须新建 **`server/.env`**（可复制 example 后改名），程序只加载 `.env`。

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek API Key。 |
| `DEEPSEEK_API_BASE` | 否 | 上游地址，默认 `https://api.deepseek.com`（无尾部斜杠）。 |
| `PORT` | 否 | 监听端口，默认 `8787`。 |
| `CORS_ORIGIN` | 生产强烈建议 | 允许访问本代理的**前端源**，多个用英文逗号分隔，如 `https://你的站点.com`。不填时开发方便但生产易被滥用，请尽量填写。 |

### API Key 与账单拆分（强烈建议）

在 [DeepSeek 控制台](https://platform.deepseek.com) **为本 App 单独创建一枚 API Key**，写入 `server/.env` 的 `DEEPSEEK_API_KEY`。**不要**与 Cursor、其它脚本共用同一 Key，否则账单里 `v4-pro` / `v4-flash` 无法区分来源。

本 App 请求会携带请求头 `X-Wengu-Ai-Source: wengu-learning-app`；代理日志会输出 `model=` 与 `source=`，便于对照控制台明细。

| 场景 | 默认模型 |
|------|----------|
| 思维导图、资料讲义 | `deepseek-v4-pro`（可通过 `VITE_DEEPSEEK_MODEL_HEAVY` 改） |
| 测验干扰项、导图小题、解答、雷达等 | `deepseek-v4-flash`（可通过 `VITE_DEEPSEEK_MODEL_DEFAULT` 改） |

---

## 三、本地联调步骤

1. 复制 `server/.env.example` 为 `server/.env`，填入 `DEEPSEEK_API_KEY`。
2. 安装依赖：`cd server && npm install`
3. 启动代理：`cd server && npm run dev`（或 `npm start`）
4. 另开终端，项目根目录：`npm run dev`（前端）
5. 浏览器使用前端即可；开发模式下请求走 `/api/ai/v1/chat/completions` → 本地代理。

---

## 四、生产部署建议

1. 将 **`server` 目录**部署到任意 Node 托管（Railway、Render、Fly.io、自有 VPS 等），设置环境变量 `DEEPSEEK_API_KEY`、`CORS_ORIGIN`（你的前端 https 源）、可选 `PORT`。
2. 前端构建时设置 **`VITE_AI_API_BASE`** 为公网可访问的代理地址，例如：`https://你的-api域名.com/v1`（需与代理路由一致：`/v1/chat/completions`）。
3. 重新执行 `npm run build` 并发布静态资源。

---

## 五、健康检查

代理提供 `GET /health`，返回 JSON（含 `hasApiKey` 等，**不包含**密钥），可用于运维探活。

### AI 代理一键体检

项目根目录执行：

```bash
npm run check:ai
```

或在 Cursor 里直接说：**「看看 AI 代理情况」**，助手会运行上述命令并解读结果。

脚本会检查：代理是否在线、Key 是否配置、最近 50 次请求的 **模型 / 来源 / tokens** 汇总。本 App 的请求带来源 `wengu-learning-app`；若 DeepSeek 账单里 v4-pro 远高于此处 Pro 次数，多半是 **Cursor 等与 App 共用了同一 Key**。

详细请求日志（JSON Lines）写在 `server/logs/ai-requests.log`（已 gitignore，仅本机保留）。
