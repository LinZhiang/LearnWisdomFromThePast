# AI 代理服务（DeepSeek 转发）

密钥仅保存在本目录的 `.env`（勿提交）。环境变量说明见项目根目录 **[docs/ENV-说明.md](../docs/ENV-说明.md)**。

```bash
cp .env.example .env   # 填写 DEEPSEEK_API_KEY
npm install
npm run dev            # 默认 http://0.0.0.0:8787
```

前端开发时由 Vite 将 `/api/ai` 代理到本服务；生产环境请单独部署并配置前端的 `VITE_AI_API_BASE`。
