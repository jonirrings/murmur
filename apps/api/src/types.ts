import app from "./index";
import { auth } from "./lib/auth";

type APIBindings = {
  ASSETS: R2Bucket;
  DB: D1Database;
};
type APIVariables = {
  session: typeof auth.$Infer.Session | null;
};

export type AppEnv = {
  Bindings: APIBindings;
  Variables: APIVariables;
};
export type AppType = typeof app;
