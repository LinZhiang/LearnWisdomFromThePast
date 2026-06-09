# Cloudflare 部署配置说明（温故智学网）

部署成功后，**请用这个地址访问**（国内一般可直连，无需 VPN）：

**https://wengu-zhixue.pages.dev**

旧的 `learn-wisdom-from-the-past.xxxxx.workers.dev` 是 Workers 域名，可不再使用。

---

## 一、在 Cloudflare 控制台怎么配（复制粘贴即可）

路径：**Workers & Pages** → **Create** → **Pages** → **Connect to Git**  
（若已有 Git 连接的项目，进 **Settings → Builds** 改下面几项。）

| 配置项 | 填什么 |
|--------|--------|
| **Project name** | `wengu-zhixue` |
| **Production branch** | `main` |
| **Root directory** | `/`（留空或填 `/`） |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Deploy command** | `npx wrangler pages deploy` |

> **不要**再填 `npx wrangler deploy`（那是 Workers，会得到 `workers.dev` 且国内常需 VPN）。

### 环境变量（Settings → Environment variables → Production）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NODE_VERSION` | `22` | Wrangler 4 需要 Node 22+ |
| `VITE_AI_API_BASE` | 例：`https://你的API域名/v1` | 可选；不配则 AI 功能不可用，其余功能正常 |

保存后点 **Retry deployment** 或 push 代码到 `main` 自动构建。

---

## 二、仓库里已帮你配好的文件

| 文件 | 作用 |
|------|------|
| `wrangler.toml` | 项目名 `wengu-zhixue`，输出目录 `dist` |
| `.node-version` | Node 22 |
| `.npmrc` | 官方 npm 源 + 解决依赖冲突 |
| `public/_redirects` | Vue 路由刷新不 404（`/* → index.html`） |

---

## 三、本地手动部署（可选）

```bash
npm run build
npm run deploy
```

等价于 `wrangler pages deploy`（会读 `wrangler.toml`）。

---

## 四、常见问题

**Q：构建卡在 Installing？**  
A：确保仓库里有 `.npmrc`，且已 push 最新 `package-lock.json`。

**Q：Deploy 报 Node 版本不够？**  
A：在 Cloudflare 环境变量加 `NODE_VERSION=22`。

**Q：页面能开但 AI 不能用？**  
A：在 Cloudflare 构建环境变量配置 `VITE_AI_API_BASE`（必须以 `/v1` 结尾），然后重新部署。详见 `docs/ENV-说明.md`。

**Q：还想用自定义域名？**  
A：Pages 项目 → **Custom domains** → 添加你的域名（域名 DNS 需在 Cloudflare）。

---

## 五、删除或停用旧 Workers 项目（可选）

若仍存在 **learn-wisdom-from-the-past** 的 Workers 项目，可在控制台 **Settings → Delete project**，避免和 Pages 混淆。
