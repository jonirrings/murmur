## 10. Wrangler 配置 (基础设施)

```toml
# wrangler.toml
name = "murmur"
main = "src/index.ts"
compatibility_date = "2025-12-01"
compatibility_flags = ["nodejs_compat"]

[vars]
RP_ID = "mm.o0x0o.com"
ORIGIN = "https://mm.o0x0o.com"
TURNSTILE_SITE_KEY = "<your-turnstile-site-key>"

# Turnstile 密钥（Secret，不写在配置文件中）
# wrangler secret put TURNSTILE_SECRET_KEY

# Workers Assets（SPA 静态资源服务）
[assets]
directory = "dist/client"
binding = "ASSETS"
html_handling = "auto-trailing-slash"
not_found_handling = "single-page-application"
run_worker_first = true

# D1 数据库
[[d1_databases]]
binding = "DB"
database_name = "murmur-db"
database_id = "<your-database-id>"

# KV 命名空间（SSR 缓存）
[[kv_namespaces]]
binding = "KV"
id = "<your-kv-namespace-id>"

# R2 存储桶（附件）
[[r2_buckets]]
binding = "R2"
bucket_name = "murmur-assets"

# Durable Objects（协作编辑 + 实时预览 + 限流 + 访客计数）
[durable_objects]
bindings = [
  { name = "COLLAB_DO", class_name = "CollaborationRoomDO" },
  { name = "RATE_LIMITER_DO", class_name = "RateLimiterDO" },
  { name = "VISITOR_COUNTER_DO", class_name = "VisitorCounterDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["CollaborationRoomDO", "RateLimiterDO"]

[[migrations]]
tag = "v2"
new_classes = ["VisitorCounterDO"]

# Cron Triggers — 定时清理过期数据
[triggers]
crons = ["*/30 * * * *"]

---
```
