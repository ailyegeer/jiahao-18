# jiahao-18 · 嘉豪的留言板

部署在 Vercel 上的极简留言板。

## 本地结构

```
.
├── index.html          # 前端页面
├── api/
│   └── messages.js     # Serverless API：GET 列表 / POST 新增
├── vercel.json         # Vercel 配置
└── package.json
```

## 环境变量（Vercel 项目 Settings → Environment Variables）

| 变量 | 说明 |
| --- | --- |
| `KV_REST_API_URL` | Upstash Redis / Vercel KV 的 REST URL |
| `KV_REST_API_TOKEN` | 对应的 REST Token |

不配 KV 也能跑，留言仅在当前 serverless 实例内存中，冷启动后丢失。

## API

- `GET /api/messages` → `{ messages: [...] }`
- `POST /api/messages` body `{ name, content }` → `{ messages: [...] }`
