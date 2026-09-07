// lib/create-api-client.ts
import { env } from "cloudflare:workers";
import { hc } from "hono/client";
import type { AppType } from "@murmur/api";

export function createServerApiClient(originalRequest?: Request) {
  const customFetch = env.MURMUR_API.fetch.bind(env.MURMUR_API);

  // 创建一个代理 fetch，自动附加认证 headers
  const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (originalRequest) {
      const cookie = originalRequest.headers.get("Cookie");
      if (cookie) headers.set("Cookie", cookie);
      const auth = originalRequest.headers.get("Authorization");
      if (auth) headers.set("Authorization", auth);
    }
    return customFetch(input, { ...init, headers });
  };

  return hc<AppType>("https://internal", { fetch: fetchWithAuth });
}
