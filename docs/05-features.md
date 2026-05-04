## 5. 功能规格

### 5.1 用户角色体系

#### 5.1.1 角色定义

| 角色         | 标识        | 笔记                     | 评论 | 管理后台           | 说明                               |
| ------------ | ----------- | ------------------------ | ---- | ------------------ | ---------------------------------- |
| **管理员**   | `admin`     | 不可创建/发布            | 可以 | 网站管理、角色分配 | 仅 OOBE 阶段预设，不可通过界面创建 |
| **笔记作者** | `author`    | 创建/编辑/发布自己的笔记 | 可以 | 查看自己的笔记     | 由管理员从评论者升级               |
| **评论者**   | `commenter` | 不可                     | 可以 | 不可访问           | 注册后默认角色                     |

#### 5.1.2 角色流转

```
注册 ──→ 评论者 ──(管理员升级)──→ 笔记作者
   │                                  │
   └──── 不可直接成为管理员 ───────────┘

管理员：仅 OOBE 阶段创建，数量固定（通常 1 人），不可被降级
```

#### 5.1.3 权限矩阵

| 操作                 | 管理员 | 笔记作者         | 评论者（已审核） | 评论者（未审核） | 未登录用户 |
| -------------------- | ------ | ---------------- | ---------------- | ---------------- | ---------- |
| 浏览已发布笔记       | ✅     | ✅               | ✅               | ✅               | ✅         |
| 发表评论             | ✅     | ✅               | ✅               | ✅（仅自己可见） | ❌         |
| 创建/编辑笔记        | ❌     | ✅（自己的）     | ❌               | ❌               | ❌         |
| 发布笔记             | ❌     | ✅（自己的）     | ❌               | ❌               | ❌         |
| 删除笔记             | ❌     | ✅（自己的）     | ❌               | ❌               | ❌         |
| 协作编辑笔记         | ❌     | ✅（被邀请的）   | ❌               | ❌               | ❌         |
| 审核笔记评论         | ❌     | ✅（自己的笔记） | ❌               | ❌               | ❌         |
| 管理用户角色         | ✅     | ❌               | ❌               | ❌               | ❌         |
| 审批用户（评论可见） | ✅     | ❌               | ❌               | ❌               | ❌         |
| 管理网站设置         | ✅     | ❌               | ❌               | ❌               | ❌         |
| 管理标签             | ✅     | ❌               | ❌               | ❌               | ❌         |
| 进入管理后台         | ✅     | ✅（受限视图）   | ❌               | ❌               | ❌         |

#### 5.1.4 OOBE（开箱体验）流程

首次部署时系统检测到无任何用户，自动进入 OOBE 模式：

```
首次访问 /admin
  → 系统检测 users 表为空
    → 重定向到 /setup（OOBE 页面）
      → 创建管理员账号
        → 注册 Passkey / 设置 Email
        → 写入 role = 'admin'
        → 创建 Session
        → 跳转到管理后台
```

OOBE 完成后，`/setup` 路由永久不可访问（由中间件检查 users 表是否已有 admin 用户）。

### 5.2 认证系统

#### 5.2.1 登录方式

| 方式               | 优先级 | 说明                              |
| ------------------ | ------ | --------------------------------- |
| WebAuthn / Passkey | P0     | 主登录方式，无密码，生物识别      |
| Email Magic Link   | P1     | 备用登录方式，用于无 Passkey 设备 |

#### 5.2.2 认证流程

```
用户访问 /admin
  → 系统检测无 admin 用户？
    → 是 → 重定向 /setup（OOBE）
    → 否 → 检查 Session (better-auth)
      → 有效 → 检查角色权限
        → admin  → 管理后台（完整权限）
        → author → 管理后台（笔记编辑视图）
        → commenter → 403
      → 无效 → 跳转 /login
        → Passkey 可用 → WebAuthn 认证
        → Passkey 不可用 → Email Magic Link
          → 发送邮件 → 用户点击链接 → 创建 Session → 检查角色 → 进入对应视图
```

#### 5.2.3 Session 策略

- Session 有效期：30 天
- Cookie: `__Secure-session-token`，HttpOnly，SameSite=Lax
- Session 中携带角色信息，每次请求通过中间件校验
- 公开笔记页面无需登录；评论需登录

#### 5.2.4 防滥用体系

| 层级         | 措施                           | 说明                                                      |
| ------------ | ------------------------------ | --------------------------------------------------------- |
| **注册防护** | Cloudflare Turnstile           | 注册/登录页面嵌入 Turnstile Widget，阻止机器人注册        |
| **评论限流** | Durable Objects Rate Limiter   | 每用户每笔记 1 条/分钟，每小时 20 条上限                  |
| **API 限流** | Cloudflare Rate Limiting Rules | 全局 API 限流：100 req/min/IP，登录接口 10 req/min/IP     |
| **评论内容** | 长度限制 + 频率检测            | 单条评论 ≤200 字符；同一用户 1 分钟内不可重复提交相同内容 |
| **协作连接** | DO 连接数限制                  | 单笔记协作房间最多 10 个 editor + 50 个 viewer            |
| **预览链接** | Token 过期 + 单次验证          | 预览 token 24h 过期；首次访问后绑定 IP（可选）            |

**Turnstile 集成**：

```typescript
// src/middleware/turnstile.ts
// 注册和登录页面验证 Turnstile token
async function verifyTurnstile(token: string, env: Env): Promise<boolean> {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${env.TURNSTILE_SECRET_KEY}&response=${token}`,
  });
  const data = (await response.json()) as { success: boolean };
  return data.success;
}
```

**评论限流（Durable Objects）**：

```typescript
// src/do/rate-limiter.do.ts
export class RateLimiterDO implements DurableObject {
  // 每用户滑动窗口限流
  // key: `${userId}:${action}:${noteId}`
  // 窗口: 1 分钟 / 1 小时
}
```

### 5.3 笔记管理

#### 5.3.1 笔记类型

| 类型 | 标识          | 用途              | 默认可见性 |
| ---- | ------------- | ----------------- | ---------- |
| 灵光 | `inspiration` | 短想法、碎片灵感  | 私密       |
| 知识 | `knowledge`   | 学到的知识点      | 发布       |
| 技巧 | `tip`         | 可复用的技巧/命令 | 发布       |
| 笔记 | `note`        | 通用笔记          | 私密       |

#### 5.3.2 编辑器功能

- **Markdown 编辑**：基于 CodeMirror 6，支持 CommonMark + GFM
- **协作编辑**：基于 Yjs CRDT，多人同时编辑同一笔记无冲突
  - 光标与选区实时同步（Yjs Awareness 协议）
  - 每位协作者显示不同颜色标识
  - 离线编辑自动合并，冲突零丢失
- **双通道传输**：
  - 默认 WebSocket（经 Durable Object 中继），稳定可靠
  - 房间内 ≥2 人时自动尝试 WebRTC P2P 升级，降低延迟
  - WebRTC 断开时自动回退到 WebSocket
- **实时预览**：编辑区右侧实时渲染预览（本地分屏 + 协作者同步）
- **快捷键**：保存（Cmd/Ctrl+S）、加粗、斜体、代码块、链接等
- **图片上传**：粘贴或拖拽图片 → 上传 R2 → 插入 Markdown 图片语法
- **自动保存**：Yjs 更新实时同步到 DO，DO 定期持久化到 D1（每 5 秒防抖）

#### 5.3.3 发布与可见性

- `draft` → `published`：发布操作，生成公开可访问的 slug URL
- `published` → `draft`：取消发布，从公开页面移除，清除 KV 缓存
- 发布时自动生成 slug（基于标题），可手动修改

### 5.4 公开笔记浏览

#### 5.4.1 SSR 页面

| 路由                  | 说明                   | 缓存策略        |
| --------------------- | ---------------------- | --------------- |
| `/`                   | 首页，最新发布笔记列表 | KV 缓存 5 分钟  |
| `/note/:slug`         | 单篇笔记详情           | KV 缓存 10 分钟 |
| `/tag/:tag`           | 标签筛选页             | KV 缓存 5 分钟  |
| `/category/:category` | 分类页                 | KV 缓存 5 分钟  |

#### 5.4.2 SSR 渲染流程

1. 请求到达 Worker
2. 从 `Accept-Language` 检测 locale（`detectLocale()`）
3. 检查 KV 缓存（key 含 locale 后缀，如 `ssr:/zh-CN`），命中则直接返回 HTML
4. 未命中 → D1 查询笔记数据
5. remark-parse 解析 Markdown → MDAST
6. remark/rehype 插件处理（GFM 表格、代码高亮、数学公式等）
7. Shiki 代码高亮（SSR 阶段完成）
8. hono/jsx 组件渲染为完整 HTML（`src/components/ssr/` 组件 + `t()` i18n）
9. 写入 KV 缓存（locale 后缀 key）
10. 返回 HTML 响应

#### 5.4.3 笔记发布时缓存失效

```
Note Published / Updated
  → 删除 /note/:slug 对应 KV key
  → 删除首页列表 KV key
  → 删除关联标签页 KV key
  → 下次请求时重新 SSR 并缓存
```

### 5.5 协作编辑与实时预览

#### 5.5.1 协作编辑架构

```
                    ┌─────────────────────────────┐
                    │    CollaborationRoomDO       │
                    │  (Durable Object per note)   │
                    │                              │
                    │  ┌─────────────────────────┐ │
                    │  │   Yjs Doc (in-memory)   │ │
                    │  │   - Markdown content    │ │
                    │  │   - Awareness state     │ │
                    │  └────────┬────────────────┘ │
                    │           │                  │
                    │  ┌────────▼────────────────┐ │
                    │  │  y-websocket server     │ │
                    │  │  - 消息广播              │ │
                    │  │  - 增量更新持久化         │ │
                    │  │  - 新连接状态恢复         │ │
                    │  └────────┬────────────────┘ │
                    │           │                  │
                    │  ┌────────▼────────────────┐ │
                    │  │  WebRTC Signaling       │ │
                    │  │  - offer/answer/ice     │ │
                    │  │  - 房间管理              │ │
                    │  └─────────────────────────┘ │
                    └──────────┬───────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         ┌────▼────┐    ┌─────▼────┐    ┌──────▼───┐
         │ Author A│    │ Author B │    │ Viewer C │
         │ (r/w)   │    │ (r/w)    │    │ (r/o)   │
         │ y-ws    │    │ y-ws+rtc │    │ y-ws    │
         └─────────┘    └──────────┘    └──────────┘
```

#### 5.5.2 协作流程

```
1. Author 打开笔记 → 创建 Yjs Doc → y-codemirror.next 绑定 CodeMirror 6
2. 通过 y-websocket 连接 CollaborationRoomDO（noteId 为房间 ID）
3. DO 从持久化存储恢复 Yjs 状态 → 同步给新加入者
4. 编辑操作 → Yjs 本地更新 → y-websocket 发送到 DO
5. DO 广播更新给房间内所有连接者
6. 房间内 ≥2 人时，前端自动尝试 y-webrtc P2P 升级
7. WebRTC 信令（offer/answer/ice-candidate）通过 DO 中转
8. P2P 建立后，Yjs 更新走 WebRTC 直连，WebSocket 降级为备份
9. 协作者光标/选区通过 Yjs Awareness 协议实时同步
10. 会话结束 → DO 将最终 Yjs 状态合并为 Markdown → 持久化到 D1
```

#### 5.5.3 Durable Object 设计

```typescript
// src/do/collaboration-room.do.ts
export class CollaborationRoomDO implements DurableObject {
  private ydoc: Y.Doc; // Yjs 文档实例
  private awareness: Map<number, object>; // 协作者感知状态
  private connections = new Map<
    WebSocket,
    {
      role: "editor" | "viewer";
      userId: string;
    }
  >();

  // WebSocket 消息协议（y-websocket 兼容）
  // 客户端 → DO: Yjs sync step1/step2/update + Awareness update
  // DO → 客户端: 广播 Yjs update + Awareness update

  // WebRTC 信令协议
  // 客户端 → DO: { type: "signal", target: userId, signal: RTCSessionDescription/RTCIceCandidate }
  // DO → 客户端: { type: "signal", from: userId, signal: ... }

  // 持久化策略
  // - Yjs 增量更新实时写入 DO storage
  // - 每 5 秒防抖将完整文档状态合并为 Markdown 写入 D1
  // - DO 销毁前确保最终状态已持久化
}
```

#### 5.5.4 传输模式对比

| 场景      | 传输模式           | 说明                        |
| --------- | ------------------ | --------------------------- |
| 单人编辑  | WebSocket only     | 无需 P2P，DO 直接中继       |
| 2+ 人协作 | WebSocket + WebRTC | 自动尝试 P2P 升级，降低延迟 |
| 只读预览  | WebSocket only     | 预览者不需要 P2P            |
| 网络受限  | WebSocket fallback | WebRTC 连接失败时自动回退   |

#### 5.5.5 预览（协作的只读模式）

```
1. Editor 点击「分享预览」→ 创建 collab_session（D1）+ 生成 token
2. 返回预览 URL：/preview/:token
3. Viewer 打开 URL → 以 read-only 角色加入 CollaborationRoomDO
4. Viewer 的 CodeMirror 实例设为 readOnly
5. Viewer 接收 Yjs 更新，实时看到编辑内容
6. Viewer 不发送编辑操作，不参与 Awareness 广播
```

#### 5.5.6 安全与隔离

- 协作房间以 noteId 为单位，仅该笔记的 author 可邀请协作者
- 预览 token 为加密随机字符串（32 字节），不可猜测
- 预览会话默认 24 小时过期
- Viewer 连接不发送编辑操作，DO 层面校验并拒绝
- Yjs 更新在 DO 端做权限校验，非 editor 角色的更新被丢弃
- 会话过期后 Durable Object 自动销毁

- 预览 token 为加密随机字符串（32 字节），不可猜测
- 预览会话默认 24 小时过期
- 仅持有 token 者可查看，无 token 无法访问
- 会话过期后 Durable Object 自动销毁

### 5.6 评论系统

#### 5.6.1 两层审核模型

评论的公开可见性由**两层审核**控制，必须同时通过才能公开显示：

```
用户注册 → approval_status = pending
  │
  ├─ 管理员审批 → approval_status = approved
  │     │
  │     └─ 用户发表评论 → author_approved = pending
  │           │
  │           ├─ 笔记作者审核通过 → author_approved = 1 → 评论公开可见
  │           └─ 笔记作者拒绝 → author_approved = -1 → 仅评论者+作者可见
  │
  └─ 管理员未审批 → approval_status = pending
        │
        └─ 用户发表评论 → 仅自己可见（不进入作者审核队列）
```

#### 5.6.2 评论模型

- 评论挂在已发布笔记下，不支持嵌套回复（Phase 1）
- 所有登录用户均可发表评论（含未审批用户）
- 评论为纯文本，不支持 Markdown（保持简洁）
- 评论需登录后发表

#### 5.6.3 评论可见性规则

| 查看者     | 未审批用户的评论 | 已审批用户 + 作者未审 | 已审批用户 + 作者通过 | 管理员隐藏   |
| ---------- | ---------------- | --------------------- | --------------------- | ------------ |
| 未登录访客 | 不可见           | 不可见                | 可见                  | 不可见       |
| 评论者本人 | 可见             | 可见                  | 可见                  | 不可见       |
| 笔记作者   | 不可见           | 可见（可审核）        | 可见                  | 不可见       |
| 管理员     | 可见             | 可见                  | 可见                  | 可见（标记） |

#### 5.6.4 评论管理

| 操作                  | 评论者 | 笔记作者           | 管理员 |
| --------------------- | ------ | ------------------ | ------ |
| 发表评论              | ✅     | ✅                 | ✅     |
| 删除自己的评论        | ✅     | ✅                 | ✅     |
| 删除他人评论          | ❌     | ❌                 | ✅     |
| 审核评论（通过/拒绝） | ❌     | ✅（自己笔记下的） | ✅     |
| 隐藏评论（不删除）    | ❌     | ❌                 | ✅     |

#### 5.6.5 评论展示

- 笔记详情页 SSR 时仅包含已通过双层审核的公开评论
- 评论按时间正序排列
- 每页 20 条，支持分页加载
- 笔记作者登录后，可看到自己笔记下待审核的评论（带"待审核"标记）
- 评论者本人可看到自己所有未隐藏的评论（含待审核，带"审核中"标记）
- 管理员隐藏的评论对普通用户不可见，对管理员显示"已隐藏"标记

#### 5.6.6 用户审批流程

```
新用户注册 → approval_status = pending
  │
  ├─ 管理员在后台「用户管理」页面看到待审批列表
  │     │
  │     ├─ 审批通过 → approval_status = approved
  │     │     └─ 用户已有评论自动进入作者审核队列
  │     │
  │     └─ 拒绝 → approval_status = rejected
  │           └─ 用户评论继续保持仅自己可见
  │
  └─ 管理员可随时修改审批状态
```

### 5.7 搜索

#### 5.7.1 实现方案

- **Phase 1**：D1 `LIKE` 查询 + 前端防抖，满足初期需求
- **Phase 2**（可选）：接入 Cloudflare Vectorize 做语义搜索

#### 5.7.2 搜索 API

```
GET /api/search?q=keyword&category=tip&tag=git&page=1&limit=20
```

### 5.8 热门笔记

#### 5.8.1 功能概述

支持按时间窗口展示热门笔记，帮助用户发现近期受关注的内容。

| 时间窗口 | 标识  | 说明        |
| -------- | ----- | ----------- |
| 1 小时   | `1h`  | 最近 1 小时 |
| 1 天     | `1d`  | 最近 1 天   |
| 1 周     | `1w`  | 最近 7 天   |
| 1 月     | `1mo` | 最近 30 天  |

#### 5.8.2 数据模型

新增 `note_views` 表，记录每次浏览事件：

```sql
CREATE TABLE note_views (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  ip TEXT,
  viewed_at TEXT NOT NULL
);
CREATE INDEX idx_note_views_note_viewed ON note_views (note_id, viewed_at);
CREATE INDEX idx_note_views_viewed_at ON note_views (viewed_at);
```

- `ip`：用于同 IP 同日去重，避免重复计数
- `viewed_at`：ISO 8601 时间戳，用于时间窗口聚合查询

#### 5.8.3 去重策略

使用 `noteId + ip + date` 组合去重：同一 IP 在同一天对同一笔记仅计一次浏览。去重在 `ViewRepo.recordView()` 中通过查询实现。

#### 5.8.4 API 端点

```
GET /api/notes/hot?period=1d&limit=20
```

| 参数   | 类型   | 默认 | 说明                           |
| ------ | ------ | ---- | ------------------------------ |
| period | string | `1d` | 时间窗口：`1h`/`1d`/`1w`/`1mo` |
| limit  | number | `20` | 返回数量，1-50                 |

返回按时间窗口内浏览量降序排列的已发布笔记列表。

#### 5.8.5 SSR 页面

| 路由   | 说明           | 缓存策略       |
| ------ | -------------- | -------------- |
| `/hot` | 热门笔记列表页 | KV 缓存 5 分钟 |

页面顶部显示时间窗口切换标签（1小时/1天/1周/1月），默认显示1天。

#### 5.8.6 缓存与失效

- 热门笔记页 KV 缓存 key：`ssr:/hot/{period}/{locale}`
- 缓存 TTL：5 分钟
- 笔记发布/更新时同时失效热门笔记缓存（所有 period × locale 组合）

#### 5.8.7 数据清理

Cron Trigger（每 30 分钟）自动清理 90 天前的 `note_views` 记录，防止表无限增长。

---
