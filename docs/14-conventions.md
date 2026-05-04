## 14. 补充约定

### 14.1 SSR 与 SPA 路由边界

```

/ (公开) → SSR (hono/jsx 组件渲染 HTML)
/note/:slug (公开) → SSR
/tag/:tag (公开) → SSR
/preview/:token (公开) → SSR + WebSocket hydration

/admin/_ (后台) → SPA (Vite 构建的 React 应用，TanStack Router)
/login → SPA 路由
/setup → SPA 路由
/assets/_ → ASSETS 绑定静态资源

```

- 公开页面由 Worker 直接 SSR 渲染（hono/jsx 组件），客户端仅做轻量交互（评论提交等）
- 管理后台是完整的 React SPA（TanStack Router 文件路由），通过 Vite 构建为静态资源
- Worker 通过 `ASSETS` 绑定（Workers Assets）提供 SPA 服务：
  - `/setup`、`/login`、`/admin/*` → `serveSpaAssets()` 从 ASSETS 获取 `/index.html`
  - `/assets/*` → `serveStaticAssets()` 从 ASSETS 获取构建产物
- `wrangler.toml` 配置 `[assets]` + `run_worker_first = true` + `not_found_handling = "single-page-application"`
- 两套应用共存于同一 Worker，Hono 路由按路径前缀分流

### 14.2 错误响应格式

所有 API 返回统一 JSON 格式：

```typescript
// 成功
{ "data": T }

// 错误
{ "error": { "code": "VALIDATION_ERROR", "message": "评论内容不能为空", "details?: ZodIssue[] } }

// HTTP 状态码约定
// 400 - 请求校验失败（Zod 校验错误）
// 401 - 未登录
// 403 - 权限不足（角色不符 / 用户未审批）
// 404 - 资源不存在
// 409 - 冲突（slug 重复、OOBE 已完成等）
// 429 - 限流
// 500 - 服务端错误
```

### 14.3 附件 URL 策略

- R2 桶设为私有，不公开访问
- 附件通过 Worker 代理路由提供：`GET /api/attachments/:id`（直接代理 R2 文件流）
- Worker 从 D1 查询 `r2_key`，从 R2 读取后流式返回，附带 `Cache-Control: public, max-age=31536000, immutable`
- 上传时生成 `r2_key = attachments/{noteId}/{crypto.randomUUID()}.{ext}`

### 14.4 Email Magic Link

- 邮件发送：Cloudflare Email Workers（接收）+ Resend API（发送）
- Token：`crypto.randomUUID()`，存入 D1 `verifications` 表，15 分钟过期
- 链接格式：`{ORIGIN}/api/auth/magic-link/verify?token={token}`
- 点击后验证 token，创建 session，重定向到 `/admin`

### 14.5 管理员站点设置

站点设置存储在 KV 中（非 D1），key 前缀 `settings:`：

```
settings:site_title                → 站点标题（默认 "Murmur"）
settings:site_description          → 站点描述（默认 "一个安静的笔记空间"）
settings:posts_per_page            → 每页笔记数（默认 "10"）
settings:comments_per_page         → 每页评论数（默认 "20"）
settings:allow_registration → 是否开放注册（默认 true）
```

### 14.6 测试策略

| 层级     | 框架               | 覆盖范围                                                                    |
| -------- | ------------------ | --------------------------------------------------------------------------- |
| 单元测试 | Vitest             | Service 层（note, comment, tag, setup, cache, render, search）、服务端 i18n |
| 集成测试 | Vitest + Miniflare | API 路由（含 RBAC 中间件）、Drizzle 查询                                    |
| E2E 测试 | Playwright         | 登录流程、笔记 CRUD、评论审核、协作编辑                                     |
| 类型检查 | tsc --noEmit       | CI 中运行，零 any                                                           |

### 14.7 i18n 架构

**客户端**（i18next + react-i18next）：

- 5 个命名空间：common（始终加载）、admin、auth、editor、comments（按需加载）
- 语言文件位于 `src/client/i18n/locales/{zh-CN,en}/`
- `useTranslation()` hook 在组件中使用
- Zustand `ui-store` 管理 locale 状态，`setLocale()` 同步调用 `i18next.changeLanguage()`
- Zod 校验消息通过 `src/client/lib/zod-i18n.ts` 本地化
- API 错误消息通过 `src/client/lib/api-error.ts` 根据 error code 映射

**服务端**（`src/shared/i18n/server.ts`）：

- `detectLocale(acceptLanguage?)` 从 `Accept-Language` header 检测，默认 `zh-CN`
- `t(key, locale, params?)` 简单翻译函数，支持 `{{param}}` 插值
- 语言文件位于 `src/shared/i18n/locales/{zh-CN,en}.json`（~14 个 SSR 专用 key）
- hono/jsx SSR 组件通过 `detectLocale()` 获取 locale，调用 `t()` 翻译
- KV 缓存 key 附加 locale 后缀（如 `ssr:/zh-CN`、`ssr:/note/:slug/en`）

### 14.7 CI/CD

- **CI**：GitHub Actions — lint + typecheck + test + build
- **CD**：`wrangler deploy`，main 分支合并后自动部署
- **Preview**：PR 自动创建 Cloudflare Preview 环境
