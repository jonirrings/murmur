import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Wrap D1Database to serialize Date objects in SQL bind parameters.
 * D1 only accepts string | number | null | ArrayBuffer — not Date objects.
 * better-auth internally creates Date objects for timestamp fields,
 * which would cause D1_TYPE_ERROR without this wrapper.
 */
function wrapD1WithDateSerialization(d1: D1Database): D1Database {
  function serializeDatesInParams(params: unknown[]): unknown[] {
    return params.map((p) => {
      if (p instanceof Date) return p.toISOString();
      return p;
    });
  }

  const wrapped = {
    prepare: (sql: string) => {
      const stmt = d1.prepare(sql);
      const originalBind = stmt.bind.bind(stmt);
      return {
        ...stmt,
        bind: (...params: unknown[]) => {
          return originalBind(...serializeDatesInParams(params));
        },
      } as D1PreparedStatement;
    },
    batch: d1.batch.bind(d1),
    exec: d1.exec.bind(d1),
  } as unknown as D1Database;

  return wrapped;
}

export function createDb(d1: D1Database) {
  return drizzle(wrapD1WithDateSerialization(d1), { schema });
}

export type Database = ReturnType<typeof createDb>;
