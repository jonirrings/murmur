import type { Context } from "hono";
import { auth } from "../lib/auth";

export const authRoutes = (c: Context) => auth.handler(c.req.raw);
