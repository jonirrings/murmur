# Murmur Agent 指南

> AI Agent（Claude Code）在实现 Murmur 项目时必须遵守的规范和约定。

---

## 1. 项目概览

Murmur 是部署在 Cloudflare Workers 上的笔记系统，支持 CRDT 协作编辑、双层评论审核、WebAuthn 认证。

**技术栈**：Hono v4 + React 19 + Vite + Tailwind CSS v4 + shadcn/ui + Drizzle ORM + Yjs + D1 + KV + R2 + Durable Objects

**详细规格**：参见 `spec.md`
**实施计划**：参见 `plan.md`

---

## 2. 文件约定

### 2.1 目录结构

```
src/
├── index.ts              # Hono 入口
├── app.ts                # Hono app 实例
├── routes/               # 路由（每个文件一个路由组）
│   ├── ssr.ts            # 公开 SSR 页面
│   └── api/              # API 路由
├── services/             # 业务逻辑（不直接操作 DB）
├── db/                   # Drizzle ORM 层
│   ├── schema.ts         # Schema 定义（Single Source of Truth）
│   ├── client.ts         # Drizzle + D1 初始化
│   └── repositories/     # 数据访问层
├── do/                   # Durable Objects
├── auth/                 # 认证配置 + RBAC
├── ssr/                  # 服务端渲染模板
├── client/               # 客户端 SPA
│   ├── pages/            # 页面组件
│   ├── components/       # 通用组件
│   │   └── ui/           # shadcn/ui 组件（按需引入）
│   ├── stores/           # Zustand 状态
│   ├── queries/          # TanStack Query
│   ├── schemas/          # Zod Schema
│   ├── hooks/            # 自定义 Hooks
│   └── lib/              # 工具函数
└── shared/               # 前后端共享
    ├── types.ts
    ├── constants.ts
    ├── rbac.ts
    └── schemas/          # Zod Schema（前后端共享）
```

### 2.2 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `note.service.ts`, `comment.repo.ts` |
| React 组件 | PascalCase | `MarkdownEditor.tsx`, `CommentList.tsx` |
| Zod Schema | camelCase + Schema 后缀 | `createCommentSchema` |
| TanStack Query hook | use + 动词 + 名词 | `useCreateNote`, `useNotes` |
| Zustand store | kebab-case + -store | `editor-store.ts`, `ui-store.ts` |
| Drizzle table | camelCase（与 JS 一致） | `notes`, `noteTags`, `collabSessions` |
| API 路由 | kebab-case | `/api/collab/rooms/:noteId` |
| 环境变量 | UPPER_SNAKE_CASE | `RP_ID`, `TURNSTILE_SECRET_KEY` |

### 2.3 导入顺序

```typescript
// 1. 外部依赖
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';

// 2. 内部模块（使用 @/ 别名）
import { notes, comments } from '@/db/schema';
import { requireAuth } from '@/auth/rbac';

// 3. 类型
import type { Database } from '@/db/client';
```

---

## 3. 编码规范

### 3.1 类型安全

- **禁止 `any`**：必须定义明确类型，Drizzle 自动推导的返回类型优先
- **Zod Schema 即类型**：`z.infer<typeof xxxSchema>` 派生类型，不重复定义
- **共享 Schema**：API 输入校验 Schema 放 `src/shared/schemas/`，前后端共用
- **Drizzle 返回类型**：用 `typeof table.$inferSelect` / `typeof table.$inferInsert`，不手写

### 3.2 API 路由

```typescript
// 标准路由模板
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createCommentSchema } from '@/shared/schemas/comment';
import { requireAuth } from '@/auth/rbac';
import { CommentService } from '@/services/comment.service';

const app = new Hono();

app.post(
  '/:noteId/comments',
  requireAuth,
  zValidator('json', createCommentSchema),
  async (c) => {
    const { noteId } = c.req.param();
    const input = c.req.valid('json');
    const user = c.get('user');
    const db = c.get('db');
    const service = new CommentService(db);
    const comment = await service.create(noteId, user.id, input.content);
    return c.json({ data: comment }, 201);
  }
);
```

### 3.3 错误处理

```typescript
// 统一错误格式
interface ApiError {
  error: {
    code: string;       // VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED
    message: string;    // 人类可读
    details?: unknown;  // Zod 校验详情
  };
}

// Hono 全局错误处理
app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: '请求校验失败', details: err.issues } }, 400);
  }
  if (err instanceof AuthError) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: err.message } }, 401);
  }
  // ...
  return c.json({ error: { code: 'INTERNAL_ERROR', message: '服务内部错误' } }, 500);
});
```

### 3.4 数据库操作

- **所有 DB 操作通过 Repository 层**：Service 不直接写 Drizzle 查询，调用 `repo.method()`
- **Drizzle 优先**：不写原始 SQL，除非 Drizzle 不支持（如 `PRAGMA`）
- **事务**：涉及多表写操作时使用 `db.transaction()`
- **迁移**：修改 `src/db/schema.ts` 后运行 `npx drizzle-kit generate`，不手写 SQL

### 3.5 React 组件

- **函数式组件 + Hooks**：禁止 class 组件
- **shadcn/ui 优先**：Button、Input、Dialog 等基础组件从 `@/components/ui/` 引入，不自己造
- **Tailwind 类名**：用 `cn()` 工具函数合并条件类名（`clsx` + `tailwind-merge`）
- **禁止内联样式**：核心样式必须用 Tailwind 类或 CSS Modules
- **状态管理边界**：
  - 服务端状态 → TanStack Query（`useQuery`, `useMutation`）
  - 客户端 UI 状态 → Zustand
  - 表单状态 → React Hook Form
  - 不用 `useState` 管可从 API 获取的数据

### 3.6 Zod Schema 前后端共享

```typescript
// src/shared/schemas/comment.ts
import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  noteId: z.string(),
});

// 前端使用
import { zodResolver } from '@hookform/resolvers/zod';
import { createCommentSchema } from '@/shared/schemas/comment';
const form = useForm({ resolver: zodResolver(createCommentSchema) });

// 后端使用
import { zValidator } from '@hono/zod-validator';
import { createCommentSchema } from '@/shared/schemas/comment';
app.post('/', zValidator('json', createCommentSchema), handler);
```

---

## 4. 架构约束

### 4.1 SSR 与 SPA 边界

- **公开页面**（`/`、`/note/:slug`、`/tag/:tag`）：Hono SSR 渲染，客户端仅轻量交互
- **管理后台**（`/admin/*`、`/login`、`/setup`）：Vite 构建的 React SPA，Worker 返回 `index.html`
- **Hono 路由分流**：`/api/*` → API，`/admin/*` → SPA fallback，其余 → SSR

### 4.2 Durable Objects 约束

- 每个 DO 实例有 128MB 内存限制，单笔记 Yjs 文档不得超过 1MB
- DO 空闲 30 秒后应持久化状态并释放内存
- DO 不直接访问 D1，通过 `this.env.DB` 绑定访问
- WebSocket 消息必须校验来源角色，viewer 的编辑操作直接丢弃

### 4.3 RBAC 执行

- **每次请求校验**：RBAC 中间件从 Session 读取 `role`，不信任客户端传入
- **路由级守卫**：`requireAdmin`、`requireAuthor`、`requireAuth` 挂在路由定义上
- **业务级校验**：笔记编辑/删除需额外校验 `author_id === userId`

### 4.4 评论可见性规则

查询评论时必须按以下规则过滤，不可遗漏：

```
用户未登录 → 仅返回 author_approved=1 AND admin_hidden=0 AND user.approval_status='approved'
用户已登录 → 上述 + 自己的评论（author_id=me AND admin_hidden=0）
笔记作者   → 上述 + 自己笔记下 approval_status='approved' 用户的待审核评论
管理员     → 所有评论（含已隐藏，标记 admin_hidden）
```

---

## 5. 安全清单

每次修改代码时检查：

- [ ] API 输入是否通过 Zod 校验
- [ ] RBAC 中间件是否挂在需要保护的路由上
- [ ] 评论查询是否按可见性规则过滤
- [ ] 协作房间是否校验连接角色
- [ ] 文件上传是否校验 MIME 类型和大小
- [ ] SQL 注入是否被 Drizzle 参数化查询阻止
- [ ] XSS 是否被 React 自动转义 + SSR HTML sanitize 阻止
- [ ] Turnstile token 是否在注册/登录时验证

---

## 6. 测试约定

### 6.1 测试文件位置

```
src/
├── services/__tests__/note.service.test.ts
├── db/repositories/__tests__/note.repo.test.ts
├── routes/api/__tests__/notes.test.ts
├── shared/schemas/__tests__/comment.test.ts
└── client/
    └── components/__tests__/CommentForm.test.tsx
```

### 6.2 测试工具

- **单元测试**：Vitest + `@cloudflare/vitest-pool-workers`（模拟 D1/KV/DO）
- **API 测试**：`app.request()` + Vitest 断言
- **组件测试**：Vitest + React Testing Library
- **E2E 测试**：Playwright + Miniflare

### 6.3 关键测试场景

- OOBE 并发创建 admin（竞争条件）
- 评论双层审核可见性（6 种角色组合）
- RBAC 中间件拦截（未登录 / 角色不足 / 角色正确）
- Yjs 协作编辑冲突合并
- 预览 token 过期后拒绝访问
- 限流 DO 触发 429

---

## 7. Git 约定

### 7.1 分支策略

```
main          ← 生产分支，自动部署
├── dev       ← 开发分支
├── feat/xxx  ← 功能分支
├── fix/xxx   ← 修复分支
└── chore/xxx ← 杂项分支
```

### 7.2 Commit 格式

```
type(scope): description

feat(editor): add Yjs collaboration binding
fix(auth): prevent concurrent OOBE admin creation
refactor(db): migrate from raw SQL to Drizzle ORM
test(comments): add dual-review visibility tests
chore(deps): update hono to v4.6
```

### 7.3 PR 要求

- 类型检查通过：`tsc --noEmit`
- Lint 通过：`eslint src/`
- 单元测试通过：`vitest run`
- Drizzle 迁移已生成：`drizzle-kit generate`（如有 schema 变更）
