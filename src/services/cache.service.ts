/**
 * KV-based SSR cache for public pages.
 * Keys: `ssr:{path}` (e.g., `ssr:/`, `ssr:/note/my-post`)
 * TTL: 5 min for home/tag pages, 10 min for note detail pages.
 */

const HOME_TTL = 300; // 5 minutes
const NOTE_TTL = 600; // 10 minutes
const SITEMAP_TTL = 3600; // 1 hour

const CACHE_PREFIX = "ssr:";

export class SsrCache {
  constructor(private kv: KVNamespace) {}

  async get(path: string): Promise<string | null> {
    try {
      return await this.kv.get(`${CACHE_PREFIX}${path}`);
    } catch {
      return null;
    }
  }

  async set(path: string, html: string, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds ?? (path.startsWith("/note/") ? NOTE_TTL : HOME_TTL);
      await this.kv.put(`${CACHE_PREFIX}${path}`, html, {
        expirationTtl: ttl,
      });
    } catch {
      // KV write failure is non-critical
    }
  }

  async invalidate(path: string): Promise<void> {
    try {
      await this.kv.delete(`${CACHE_PREFIX}${path}`);
    } catch {
      // KV delete failure is non-critical
    }
  }

  async invalidateNote(slug: string, category?: string): Promise<void> {
    const locales = ["zh-CN", "en"];
    const hotPeriods = ["1h", "1d", "1w", "1mo"];
    await Promise.all(
      locales.flatMap((locale) => [
        this.invalidate(`/note/${slug}/${locale}`),
        this.invalidate(`/${locale}`),
        ...(category ? [this.invalidate(`/category/${category}/${locale}`)] : []),
        ...hotPeriods.map((period) => this.invalidate(`/hot/${period}/${locale}`)),
      ]),
    );
  }

  async invalidateAll(): Promise<void> {
    try {
      const list = await this.kv.list({ prefix: CACHE_PREFIX });
      await Promise.all(list.keys.map((key) => this.kv.delete(key.name)));
    } catch {
      // KV list/delete failure is non-critical
    }
  }
}

/**
 * KV cache for sitemap.
 */
export class SitemapCache {
  constructor(private kv: KVNamespace) {}

  async get(): Promise<string | null> {
    try {
      return await this.kv.get("seo:sitemap");
    } catch {
      return null;
    }
  }

  async set(xml: string): Promise<void> {
    try {
      await this.kv.put("seo:sitemap", xml, {
        expirationTtl: SITEMAP_TTL,
      });
    } catch {
      // Non-critical
    }
  }
}
