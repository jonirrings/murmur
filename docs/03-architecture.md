## 3. 架构设计

### 3.1 系统架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                               │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │Public SSR │ │Admin SPA │ │Author SPA│ │  Collaborative Editor  │ │
│  │(Note+Comment)│(User Mgmt)│ (Editor)  │ │ (Yjs + CodeMirror 6)  │ │
│  └─────┬────┘ └────┬─────┘ └────┬─────┘ └──────────┬─────────────┘ │
│        │            │            │                    │              │
│  ┌─────▼────────────▼────────────▼────────────────────▼───────────┐ │
│  │                        Hono Router                              │ │
│  │  ┌────────┐ ┌──────────┐ ┌──────┐ ┌──────────────────────────┐ │ │
│  │  │  SSR   │ │ REST API │ │ OOBE │ │  WebSocket + Signaling   │ │ │
│  │  │ Routes │ │ + RBAC   │ │Route │ │  (Collab + Preview)      │ │ │
│  │  └───┬────┘ └────┬─────┘ └──┬───┘ └───────────┬──────────────┘ │ │
│  └──────┼────────────┼──────────┼─────────────────┼────────────────┘ │
│         │            │          │                 │                  │
│  ┌──────▼────┐ ┌─────▼─────┐  │  ┌──────────────▼───────────────┐ │
│  │ KV Cache  │ │    D1     │  │  │     Durable Objects          │ │
│  │ (Read)    │ │  (R/W)    │  │  │  ┌─────────────────────────┐ │ │
│  └───────────┘ └───────────┘  │  │  │ CollaborationRoomDO     │ │ │
│                     ▲         │  │  │ - Yjs doc state         │ │ │
│                     │    ┌────┴────┤ │ - WebSocket relay       │ │ │
│                     └────┤  R2     │ │ - WebRTC signaling      │ │ │
│                          │(Assets) │ │ - Awareness (光标/选区)   │ │ │
│                          └─────────┘ └─────────────────────────┘ │ │
│                                      └────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Client (Browser)                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │ y-websocket  │  │  y-webrtc    │  │  y-codemirror.next   │ │ │
│  │  │ (默认传输)    │  │ (P2P 升级)   │  │  (编辑器绑定)         │ │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │ │
│  │         └──────────────────┴─────────────────────┘             │ │
│  │                       Yjs Doc (CRDT)                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 请求流程

#### 公开笔记访问（SSR）

```
Request → Hono Router → KV Cache Hit?
  ├─ Yes → Return cached HTML
  └─ No  → D1 Query → remark-parse Render → HTML Response
```

#### 管理后台（SPA + API）

```
Request → Hono Router → better-auth Guard → RBAC 中间件 → REST API → D1 R/W
                                                    │
                                            requireAdmin → 用户管理、角色分配、评论管理
                                            requireAuthor → 笔记 CRUD、发布
                                            requireAuth  → 发表评论
```

#### OOBE 初始化

```
Request → /setup → 检查 users 表是否有 admin
  → 无 admin → 渲染 OOBE 页面 → 创建 admin → 跳转后台
  → 有 admin → 302 重定向到 /login
```

#### 实时协作编辑（CRDT + WebSocket/WebRTC）

```
1. Author 打开笔记编辑器
2. 前端创建 Yjs Doc + y-codemirror.next 绑定
3. 通过 y-websocket 连接到 CollaborationRoomDO（noteId 为房间 ID）
4. DO 从持久化存储恢复 Yjs 状态 → 同步给新加入者
5. 编辑操作 → Yjs 本地更新 → 通过 WebSocket 发送到 DO
6. DO 广播更新给房间内所有连接者
7. 当房间内 ≥2 人时，自动尝试 WebRTC 升级（y-webrtc）
8. WebRTC 信令通过 DO 中转
9. P2P 连接建立后，数据走 WebRTC 直连，WebSocket 降级为备份通道
10. 会话结束时，DO 将最终 Yjs 状态持久化并同步回 D1
```

#### 实时预览（协作的只读模式）

```
预览是协作编辑的只读子集：
1. Editor 点击「分享预览」→ 生成带 token 的预览 URL
2. Viewer 打开 URL → 以 read-only 模式加入同一 CollaborationRoomDO
3. Viewer 接收 Yjs 更新但不发送编辑操作
4. Viewer 的 CodeMirror 实例设为 readOnly，仅渲染最新内容
```

---
