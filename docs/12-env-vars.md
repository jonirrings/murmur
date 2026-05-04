## 12. 环境变量与密钥

| 变量                   | 说明                               | 存储位置           |
| ---------------------- | ---------------------------------- | ------------------ |
| `RP_ID`                | WebAuthn Relying Party ID          | wrangler.toml vars |
| `ORIGIN`               | 站点完整 URL                       | wrangler.toml vars |
| `BETTER_AUTH_SECRET`   | Auth 加密密钥                      | Wrangler Secrets   |
| `BETTER_AUTH_URL`      | Auth 回调 URL                      | wrangler.toml vars |
| `R2_PUBLIC_URL`        | R2 公开访问域名                    | wrangler.toml vars |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile 服务端密钥    | Wrangler Secrets   |
| `TURNSTILE_SITE_KEY`   | Cloudflare Turnstile 前端 Site Key | wrangler.toml vars |
| `ADMIN_EMAIL`          | OOBE 管理员邮箱白名单（可选）      | Wrangler Secrets   |

---
