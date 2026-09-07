import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import * as process from "node:process";

// api 的源码会被 portal 拉进同一个 TS program 一起检查，而两边的
// worker-configuration.d.ts 声明的 Cloudflare.Env 不同，因此这里显式
// 声明 D1 绑定的类型（D1Database 是生成文件里的全局声明，两个 program 都有）。
type ApiBindings = { DB: D1Database };

const db = drizzle((env as unknown as ApiBindings).DB, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export default db;
