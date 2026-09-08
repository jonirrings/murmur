export type Tag = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  snippetCount?: number;
};

export type SnippetStatus = "draft" | "published" | "archived";
export type SnippetVisibility = "public" | "unlisted" | "private";

export type Snippet = {
  id: number;
  slug: string;
  title: string;
  contentMd: string;
  excerpt: string | null;
  language: string | null;
  coverImage: string | null;
  status: SnippetStatus;
  visibility: SnippetVisibility;
  authorId: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type SessionInfo = {
  session: unknown;
  user: { id: string; name: string; email: string };
};

/** 同源 fetch：自动带 session cookie；非 GET 默认带 JSON Content-Type；失败时 throw Error */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const needsJson = method !== "GET" && method !== "HEAD";

  const res = await fetch(path, {
    ...init,
    headers: {
      ...(needsJson ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const body = data as { error?: string; message?: string } | null;
    throw new Error(body?.error ?? body?.message ?? `请求失败 (${res.status})`);
  }
  return data as T;
}

/** 提取字段校验错误消息（TanStack Form 的 Standard Schema issue 可能是对象） */
export function errorMessages(errors: unknown[]): string[] {
  return errors.map((e) => {
    if (typeof e === "string") return e;
    if (e && typeof e === "object" && "message" in e) {
      return String((e as { message: unknown }).message);
    }
    return String(e);
  });
}
