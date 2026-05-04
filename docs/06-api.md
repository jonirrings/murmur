## 6. API 设计

### 6.1 认证

> better-auth 自动提供认证端点，以下为当前启用的路由：

```
POST /api/auth/magic-link/send      # 发送 Magic Link ✅
GET  /api/auth/magic-link/verify    # 验证 Magic Link ✅
POST /api/auth/logout               # 登出 ✅
GET  /api/auth/session              # 获取当前 Session ✅

# Passkey（@better-auth/passkey 自动注册）
GET  /api/auth/passkey/generate-register-options   # 生成注册选项 ✅
POST /api/auth/passkey/verify-registration         # 验证注册 ✅
GET  /api/auth/passkey/generate-authenticate-options # 生成认证选项 ✅
POST /api/auth/passkey/verify-authentication       # Passkey 登录验证 ✅
GET  /api/auth/passkey/list-user-passkeys          # 列出用户 Passkey ✅
POST /api/auth/passkey/delete-passkey              # 删除 Passkey ✅

# TOTP 2FA（better-auth twoFactor 插件自动注册）
POST /api/auth/two-factor/enable          # 启用 2FA ✅
POST /api/auth/two-factor/disable         # 禁用 2FA ✅
POST /api/auth/two-factor/verify-totp     # 验证 TOTP 代码 ✅
POST /api/auth/two-factor/generate-backup-codes # 生成备份码 ✅
POST /api/auth/two-factor/get-totp-uri    # 获取 TOTP URI ✅
```

### 6.2 OOBE（开箱体验）

```
GET  /api/setup/status              # 检查是否需要 OOBE（有无 admin 用户）
POST /api/setup/admin               # OOBE：创建管理员账号
```

### 6.3 管理员 API

```
GET    /api/admin/users                      # 用户列表（含角色、审批状态）
PATCH  /api/admin/users/:id/role             # 修改用户角色（commenter ↔ author）
PATCH  /api/admin/users/:id/approval         # 审批用户（pending → approved / rejected）
GET    /api/admin/users/pending              # 待审批用户列表
GET    /api/admin/stats                      # 站点统计（笔记数、用户数、评论数）
DELETE /api/admin/comments/:id               # 删除评论
PATCH  /api/admin/comments/:id               # 隐藏/显示评论（admin_hidden）
GET    /api/admin/settings                   # 获取站点设置
PATCH  /api/admin/settings                   # 更新站点设置
```

### 6.4 笔记 CRUD

```
GET    /api/notes                    # 列表（分页、筛选）[author: 自己的笔记; admin: 全部]
POST   /api/notes                    # 创建（仅 author）
GET    /api/notes/:id                # 详情
PATCH  /api/notes/:id                # 更新（仅 author 本人）
DELETE /api/notes/:id                # 删除（仅 author 本人）
POST   /api/notes/:id/publish        # 发布（仅 author 本人）
POST   /api/notes/:id/unpublish      # 取消发布（仅 author 本人）
```

### 6.5 评论

```
GET    /api/notes/:noteId/comments            # 笔记评论列表（仅公开评论 + 本人评论）
POST   /api/notes/:noteId/comments            # 发表评论（需登录：author/commenter/admin）
DELETE /api/comments/:id                      # 删除自己的评论
```

### 6.5.1 评论审核

```
PATCH  /api/comments/:id/review              # 审核评论（作者通过/拒绝 + 管理员隐藏/显示）✅
GET    /api/admin/comments/pending           # 待审核评论列表（管理员）✅
```

> **注意**：原设计使用独立的 approve/reject 端点，实际实现为统一的 `PATCH /api/comments/:id/review`，
> 通过 JSON body 区分操作：`{ authorApproved: boolean }` 或 `{ adminHidden: boolean }`。

### 6.6 标签

```
GET    /api/tags                     # 所有标签
POST   /api/tags                     # 创建标签（仅 admin）
DELETE /api/tags/:id                 # 删除标签（仅 admin）
```

### 6.7 附件

```
POST   /api/attachments              # 上传图片/文件 → R2 ✅
DELETE /api/attachments/:id          # 删除附件 ✅
GET    /api/attachments/:id          # 代理下载 R2 文件（流式返回） ✅
```

### 6.8 协作与预览

```
POST   /api/collab/rooms/:noteId             # 创建/加入协作房间（返回 WebSocket URL）
GET    /api/collab/rooms/:noteId/info         # 房间信息（在线人数、协作者列表）
GET    /api/collab/rooms/:noteId/sessions     # 列出活跃会话
DELETE /api/collab/rooms/:noteId/sessions/:id # 停用指定会话
DELETE /api/collab/rooms/:noteId              # 关闭协作房间
POST   /api/collab/cleanup                    # 管理员清理过期会话

POST   /api/collab/preview/:noteId            # 创建预览 token（只读模式）
DELETE /api/collab/preview/:token             # 关闭预览会话
GET    /preview/:token                        # 预览页面（SSR）

WS     /api/collab/ws/:noteId                 # WebSocket 连接（y-websocket 协议 + WebRTC 信令）
WS     /api/collab/ws/:noteId?role=viewer     # WebSocket 连接（只读模式）
```

### 6.9 搜索

```
GET    /api/search?q=&category=&tag=&page=&limit=
```

### 6.10 访客计数

```
WS     /api/visitor-counter/ws?pageKey=   # WebSocket 连接（实时在线计数）
GET    /api/visitor-counter/counts         # 全站各页面在线人数（JSON）
GET    /api/visitor-counter/count?pageKey= # 单页面在线人数
```

### 6.11 阅读量统计

```
POST   /api/admin/view-stats/sync         # 从 Cloudflare Analytics 同步阅读量（管理员）
GET    /api/admin/view-stats               # 获取已发布笔记阅读量排行（管理员）
```

### 6.12 热门笔记

```
GET    /api/notes/hot?period=1d&limit=20   # 按时间窗口获取热门笔记（公开）
```

| 参数   | 类型   | 默认 | 说明                           |
| ------ | ------ | ---- | ------------------------------ |
| period | string | `1d` | 时间窗口：`1h`/`1d`/`1w`/`1mo` |
| limit  | number | `20` | 返回数量，1-50                 |

---
