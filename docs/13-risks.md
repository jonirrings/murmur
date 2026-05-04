## 13. 技术风险与应对

| 风险                               | 影响                             | 应对                                                                 |
| ---------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| D1 冷启动延迟                      | 首次请求慢                       | KV 缓存覆盖热路径；D1 首次查询后保持连接                             |
| ~~comark 在 Workers 中运行兼容性~~ | ~~渲染失败~~                     | ✅ 已改用 remark-parse + remark-rehype + rehype-sanitize             |
| Yjs 在 Durable Objects 中内存占用  | 大文档多协作者时内存高           | 限制单文档最大 1MB；DO 空闲 30 秒后持久化并释放内存                  |
| WebRTC NAT 穿透失败                | P2P 连接无法建立                 | 自动回退到 WebSocket 中继，用户无感知                                |
| Yjs 增量更新丢失                   | 协作编辑内容丢失                 | DO 持久化 Yjs 状态到 storage；WebSocket 断连重连时自动同步           |
| better-auth 与 D1 兼容性           | 认证失败                         | better-auth 官方支持 D1 adapter，风险低                              |
| WebAuthn 跨设备问题                | 用户无法登录                     | 提供 Email Magic Link 作为备用                                       |
| OOBE 并发竞争                      | 多人同时创建 admin               | 使用 D1 事务 + 二次校验防止重复创建                                  |
| 角色提升提权风险                   | 非法获取 author/admin 权限       | RBAC 中间件在每次请求校验角色，不信任客户端传入                      |
| 评论滥用                           | 垃圾评论、恶意内容               | 双层审核（用户审批 + 作者审核）+ 管理员隐藏机制                      |
| 协作房间权限泄露                   | 非授权用户编辑笔记               | DO 校验每个连接的角色，viewer 的编辑操作被丢弃                       |
| 机器人注册                         | 批量创建垃圾账号                 | Cloudflare Turnstile 人机验证 + Rate Limiter 限流                    |
| API 滥用                           | 暴力请求耗尽资源                 | Cloudflare Rate Limiting Rules + DO 滑动窗口限流                     |
| ~~shadcn/ui 组件体积~~             | ~~按需引入失控导致 bundle 膨胀~~ | ✅ 未引入 shadcn/ui，使用纯 Tailwind 手写组件                        |
| Tailwind 类名冲突                  | SSR 与 SPA 样式不一致            | Tailwind v4 content 扫描覆盖 SSR + SPA 路径；CI 中运行样式一致性检查 |

---
