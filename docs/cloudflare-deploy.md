# Cloudflare 部署（温故智学网）

## 为什么地址还是 `learn-wisdom-from-the-past....workers.dev`？

1. **控制台里现在是 Workers 项目**，不是 Pages → 域名只能是 `*.workers.dev`（国内常连不上）。
2. **改仓库配置不会自动改 Cloudflare 项目类型**；必须在控制台新建 **Pages**，或改用下方 GitHub Actions。
3. 本地曾有 2 个 commit 未 push，Cloudflare 一直在用旧配置构建。

**目标地址（国内一般可直连）：**

### https://wengu-zhixue.pages.dev

（若你以前用过 `learning-app-ad8.pages.dev`，也可以把 `wrangler.toml` 里的 `name` 改回 `learning-app-ad8`。）

---

## 方案 A：Cloudflare 控制台（推荐，一次配好）

### 第 1 步：新建 Pages（不要改原来的 Workers）

1. 打开 https://dash.cloudflare.com → **Workers & Pages**
2. 点 **Create** → 选 **Pages**（不要选 Workers）
3. **Connect to Git** → 选 GitHub → 仓库 `LearnWisdomFromThePast`

### 第 2 步：构建配置（逐项复制）

| 配置项 | 填写内容 |
|--------|----------|
| Project name | `wengu-zhixue` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| **Deploy command** | **留空**（Pages 不需要 deploy 命令） |

若界面**必须**填 Deploy command，才填：`npx wrangler pages deploy`

**千万不要填** `npx wrangler deploy`（这就是你现在 workers.dev 的原因）。

### 第 3 步：环境变量

**Settings → Environment variables → Production**：

| 变量 | 值 |
|------|-----|
| `NODE_VERSION` | `22` |

（可选）`VITE_AI_API_BASE` = 你的 AI 代理地址，以 `/v1` 结尾。

### 第 4 步：保存并部署

点 **Save and Deploy**。成功后访问：**https://wengu-zhixue.pages.dev**

### 第 5 步：关掉旧 Workers（避免混淆）

1. 打开项目 **learn-wisdom-from-the-past**（Workers 那个）
2. **Settings** → **Git integration** → **Disconnect**（断开 Git 自动构建）
3. 可选：**Delete project** 删除整个 Workers 项目

---

## 方案 B：GitHub Actions 自动发布到 Pages

适合不想折腾 Cloudflare 构建界面时使用。

### 1. 获取 Cloudflare API Token

1. Cloudflare → 右上角头像 → **My Profile** → **API Tokens**
2. **Create Token** → 模板 **Edit Cloudflare Workers**
3. 权限至少包含：**Account → Cloudflare Pages → Edit**
4. 复制生成的 Token

### 2. 获取 Account ID

Workers & Pages 首页右侧 **Account ID**，复制。

### 3. 在 GitHub 仓库加 Secrets

仓库 **Settings → Secrets and variables → Actions → New repository secret**：

| Secret 名称 | 内容 |
|-------------|------|
| `CLOUDFLARE_API_TOKEN` | 上一步的 Token |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |
| `VITE_AI_API_BASE` | （可选）AI 代理地址 |

### 4. Push 代码到 main

推送后 Actions 会自动跑 `.github/workflows/cloudflare-pages.yml`，部署到 **wengu-zhixue.pages.dev**。

同样建议 **断开** 旧 Workers 项目的 Git 连接，避免重复构建。

---

## 仓库内已配置的文件

| 文件 | 作用 |
|------|------|
| `wrangler.toml` | Pages 项目名 `wengu-zhixue` |
| `public/_redirects` | SPA 路由刷新 |
| `.npmrc` / `.node-version` | 依赖安装与 Node 22 |
| `.github/workflows/cloudflare-pages.yml` | Actions 自动部署 |

---

## 对照：Workers vs Pages

| | Workers（你现在） | Pages（应改成） |
|---|------------------|----------------|
| 域名 | `xxx.1806154588.workers.dev` | `wengu-zhixue.pages.dev` |
| 国内访问 | 常需 VPN | 一般可直连 |
| Deploy 命令 | `npx wrangler deploy` | 留空或 `npx wrangler pages deploy` |

---

## 自定义域名（可选）

Pages 项目 → **Custom domains** → 添加你的域名（域名需在 Cloudflare 解析）。
