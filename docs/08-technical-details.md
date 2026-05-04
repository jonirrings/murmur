## 8. 关键技术实现

### 8.1 SSR 渲染管线

```typescript
// src/services/render.service.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';       // CommonMark 解析
import remarkGfm from 'remark-gfm';           // GFM 扩展
import remarkRehype from 'remark-rehype';     // remark → rehype 转换
import rehypeSanitize from 'rehype-sanitize'; // XSS 防护
import rehypeStringify from 'rehype-stringify'; // HAST → HTML

const pipeline = unified()
  .use(remarkParse)              // Markdown → MDAST
  .use(remarkGfm)                // GFM 支持（表格、删除线等）
  .use(remarkRehype)             // MDAST → HAST
  .use(rehypeSanitize, { ... })  // XSS 防护
  .use(rehypeStringify)          // HAST → HTML

export async function renderMarkdown(content: string): Promise<string> {
  const result = await pipeline.process(content);
  return String(result);
}
```

### 8.2 KV 缓存策略

```typescript
// 缓存 key 设计（含 locale 后缀）
const cacheKeys = {
  home: (locale: string) => `ssr:/${locale}`,
  noteDetail: (slug: string, locale: string) => `ssr:/note/${slug}/${locale}`,
  tagPage: (tag: string, locale: string) => `ssr:/tag/${tag}/${locale}`,
  categoryPage: (cat: string, locale: string) => `ssr:/category/${cat}/${locale}`,
};

// 缓存失效：笔记发布/更新时（需清除所有 locale）
async function invalidateNoteCache(slug: string, tags: string[], category: string) {
  const locales = ["zh-CN", "en"];
  await Promise.all([
    ...locales.map((l) => env.KV.delete(cacheKeys.home(l))),
    ...locales.map((l) => env.KV.delete(cacheKeys.noteDetail(slug, l))),
    ...tags.flatMap((t) => locales.map((l) => env.KV.delete(cacheKeys.tagPage(t, l)))),
    ...locales.map((l) => env.KV.delete(cacheKeys.categoryPage(category, l))),
  ]);
}
```

### 8.3 CollaborationRoomDO（协作房间 + 实时预览）

```typescript
// src/do/collaboration-room.do.ts
import * as Y from "yjs";
import { setupWSConnection } from "y-websocket/bin/utils";

export class CollaborationRoomDO implements DurableObject {
  private ydoc = new Y.Doc();
  private connections = new Map<
    WebSocket,
    {
      role: "editor" | "viewer";
      userId: string;
    }
  >();
  private lastPersist = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { 0: client, 1: server } = new WebSocketPair();

    // 从 URL 参数或 cookie 中提取用户信息和角色
    const role = url.searchParams.get("role") as "editor" | "viewer";
    const userId = url.searchParams.get("userId") || "";

    server.accept();
    this.connections.set(server, { role, userId });

    // y-websocket 协议：同步 Yjs 文档状态
    // 新连接 → 发送当前文档状态 → 接收后续增量更新
    setupWSConnection(this.ydoc, server);

    // WebRTC 信令中转
    server.addEventListener("message", (event) => {
      const data = JSON.parse(event.data as string);

      // 信令消息转发给目标用户
      if (data.type === "signal" && data.target) {
        for (const [ws, info] of this.connections) {
          if (info.userId === data.target && ws !== server) {
            ws.send(
              JSON.stringify({
                type: "signal",
                from: userId,
                signal: data.signal,
              }),
            );
          }
        }
        return;
      }

      // 权限校验：viewer 不允许发送编辑操作
      if (role === "viewer" && data.type === "update") {
        return; // 丢弃 viewer 的编辑操作
      }
    });

    // Awareness：广播协作者加入/离开
    this.broadcastAwareness();

    server.addEventListener("close", () => {
      this.connections.delete(server);
      this.broadcastAwareness();
      // 无连接时延迟持久化并销毁
      if (this.connections.size === 0) {
        this.schedulePersistAndDestroy();
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // 广播协作者在线状态
  private broadcastAwareness() {
    const users = Array.from(this.connections.values()).map((c) => ({
      userId: c.userId,
      role: c.role,
    }));
    const msg = JSON.stringify({ type: "awareness", users });
    for (const ws of this.connections.keys()) {
      ws.send(msg);
    }
  }

  // 防抖持久化：5 秒内合并更新写入 D1
  private schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persistToD1(), 5000);
  }

  // 将 Yjs 文档状态转为 Markdown 并写入 D1
  private async persistToD1() {
    const content = this.ydoc.getText("content").toString();
    const title = this.ydoc.getText("title").toString();
    // 调用 D1 更新笔记
    // await this.env.DB.prepare('UPDATE notes SET content = ?, title = ? WHERE id = ?')
    //   .bind(content, title, noteId).run();
  }
}
```

### 8.4 better-auth 配置（含角色扩展）

```typescript
// src/auth/better-auth.config.ts
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins/magic-link";
import { admin } from "better-auth/plugins/admin";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth(env: Env) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "commenter",
          input: false, // 注册时不可设置，由系统控制
        },
        approvalStatus: {
          type: "string",
          defaultValue: "pending",
          input: false, // 注册时不可设置，由管理员控制
          fieldName: "approval_status",
        },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, token, url }) => {
          // 通过邮件服务发送 Magic Link
          await sendEmail(email, url);
        },
      }),
      admin(), // 管理员插件（用户管理、封禁、模拟登录）
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 天
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
  });
}
```

> **注意**：better-auth admin 插件需要 `user` 表包含 `banned`、`ban_reason`、`ban_expires` 字段，
> `session` 表包含 `impersonated_by` 字段。这些字段已添加到 `src/db/schema.ts`。

### 8.5 RBAC 中间件

```typescript
// src/auth/middleware.ts — 四级认证守卫
// 从 better-auth session 获取用户信息，再查 D1 获取 role 和 approvalStatus

// 四级中间件，按需使用
export const requireAuth; // 仅需登录
export const requireApproved; // 需要登录 + approvalStatus === 'approved'（评论发表用）
export const requireAuthor; // 需要 author 或 admin 角色
export const requireAdmin; // 需要 admin 角色
```

```typescript
// src/shared/rbac.ts — 角色层级与工具函数
export const ROLE_HIERARCHY: Record<string, number> = {
  admin: 3,
  author: 2,
  commenter: 1,
} as const;

export function hasRole(userRole: string, minRole: string): boolean { ... }
export function isAdmin(role: string): boolean { ... }
export function isAuthorOrAbove(role: string): boolean { ... }
```

> **注意**：原设计使用 `requireRole()` 高阶函数，实际实现为四个独立的中间件函数。
> 新增了 `requireApproved` 中间件（评论发表需用户审批通过），这是原设计中未提及的。

### 8.6 OOBE 初始化流程

```typescript
// src/services/setup.service.ts
import { eq, count } from 'drizzle-orm';
import { users } from '../db/schema';
import type { Database } from '../db/client';

export async function needsSetup(db: Database): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.role, 'admin'));
  return (result?.count ?? 0) === 0;
}

export async function createInitialAdmin(
  db: Database,
   { email: string; name: string }
): Promise<void> {
  // 二次校验：防止并发创建
  if (!(await needsSetup(db))) {
    throw new Error('Setup already completed');
  }

  // 通过 better-auth 注册用户，然后直接将 role 更新为 admin
  await db
    .update(users)
    .set({ role: 'admin' })
    .where(eq(users.email, data.email));
}
```

### 8.7 评论服务（双层审核）

```typescript
// src/services/comment.service.ts
import { eq, and, or, asc } from "drizzle-orm";
import { comments, users } from "../db/schema";
import type { Database } from "../db/client";

export class CommentService {
  constructor(private db: Database) {}

  async create(noteId: string, authorId: string, content: string) {
    const now = new Date().toISOString();
    return this.db.insert(comments).values({
      id: crypto.randomUUID(),
      noteId,
      authorId,
      content,
      authorApproved: 0, // pending
      adminHidden: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 公开评论列表：双层审核通过 + 未隐藏
  async listPublic(noteId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorName: users.name,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(
        and(
          eq(comments.noteId, noteId),
          eq(comments.authorApproved, 1),
          eq(comments.adminHidden, 0),
          eq(users.approvalStatus, "approved"),
        ),
      )
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
  }

  // 笔记作者视角：看到已审批用户的所有评论（含待审核）
  async listForAuthor(noteId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorApproved: comments.authorApproved,
        authorName: users.name,
        authorApprovalStatus: users.approvalStatus,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(
        and(
          eq(comments.noteId, noteId),
          eq(comments.adminHidden, 0),
          eq(users.approvalStatus, "approved"),
        ),
      )
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
  }

  // 评论者本人视角：看到自己所有未隐藏的评论（含待审核）
  async listForSelf(noteId: string, userId: string, page: number, limit: number) {
    return this.db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorApproved: comments.authorApproved,
        authorName: users.name,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(
        and(
          eq(comments.noteId, noteId),
          eq(comments.adminHidden, 0),
          or(eq(comments.authorApproved, 1), eq(comments.authorId, userId)),
        ),
      )
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
  }

  // 笔记作者审核评论
  async approveByAuthor(commentId: string) {
    return this.db
      .update(comments)
      .set({ authorApproved: 1, updatedAt: new Date().toISOString() })
      .where(eq(comments.id, commentId));
  }

  async rejectByAuthor(commentId: string) {
    return this.db
      .update(comments)
      .set({ authorApproved: 0, updatedAt: new Date().toISOString() }) // 0 = rejected/pending
      .where(eq(comments.id, commentId));
  }

  // 管理员隐藏评论
  async hideByAdmin(commentId: string) {
    return this.db
      .update(comments)
      .set({ adminHidden: 1, updatedAt: new Date().toISOString() })
      .where(eq(comments.id, commentId));
  }
}
```

---
