import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { SsrCache, SitemapCache } from "../cache.service";

function createMockKv() {
  return {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  };
}

describe("SsrCache", () => {
  let kv: ReturnType<typeof createMockKv>;
  let cache: SsrCache;

  beforeEach(() => {
    kv = createMockKv();
    cache = new SsrCache(kv as any);
  });

  describe("get", () => {
    it("returns cached HTML", async () => {
      kv.get.mockResolvedValue("<html>cached</html>");
      const result = await cache.get("/");
      expect(result).toBe("<html>cached</html>");
      expect(kv.get).toHaveBeenCalledWith("ssr:/");
    });

    it("returns null on miss", async () => {
      kv.get.mockResolvedValue(null);
      const result = await cache.get("/note/test");
      expect(result).toBeNull();
    });

    it("returns null on KV error", async () => {
      kv.get.mockRejectedValue(new Error("KV error"));
      const result = await cache.get("/");
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("stores with default TTL for home page", async () => {
      await cache.set("/", "<html>home</html>");
      expect(kv.put).toHaveBeenCalledWith("ssr:/", "<html>home</html>", {
        expirationTtl: 300,
      });
    });

    it("stores with note TTL for note pages", async () => {
      await cache.set("/note/test", "<html>note</html>");
      expect(kv.put).toHaveBeenCalledWith("ssr:/note/test", "<html>note</html>", {
        expirationTtl: 600,
      });
    });

    it("stores with custom TTL", async () => {
      await cache.set("/tag/test", "<html>tag</html>", 120);
      expect(kv.put).toHaveBeenCalledWith("ssr:/tag/test", "<html>tag</html>", {
        expirationTtl: 120,
      });
    });

    it("silently ignores KV errors", async () => {
      kv.put.mockRejectedValue(new Error("KV write error"));
      await expect(cache.set("/", "html")).resolves.toBeUndefined();
    });
  });

  describe("invalidate", () => {
    it("deletes the cache key", async () => {
      await cache.invalidate("/");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/");
    });

    it("silently ignores KV errors", async () => {
      kv.delete.mockRejectedValue(new Error("KV error"));
      await expect(cache.invalidate("/")).resolves.toBeUndefined();
    });
  });

  describe("invalidateNote", () => {
    it("invalidates note, home, and hot pages for all locales", async () => {
      await cache.invalidateNote("my-post");
      // 3 locales × (1 note + 1 home + 4 hot periods) = 18
      expect(kv.delete).toHaveBeenCalledTimes(18);
      expect(kv.delete).toHaveBeenCalledWith("ssr:/note/my-post/zh-CN");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/zh-CN");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/note/my-post/en");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/en");
      // Hot pages
      expect(kv.delete).toHaveBeenCalledWith("ssr:/hot/1h/zh-CN");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/hot/1d/zh-CN");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/hot/1w/zh-CN");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/hot/1mo/zh-CN");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/hot/1h/en");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/hot/1d/en");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/hot/1w/en");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/hot/1mo/en");
    });
  });

  describe("invalidateAll", () => {
    it("deletes all keys with ssr: prefix", async () => {
      kv.list.mockResolvedValue({
        keys: [{ name: "ssr:/" }, { name: "ssr:/note/test" }],
      });
      await cache.invalidateAll();
      expect(kv.delete).toHaveBeenCalledWith("ssr:/");
      expect(kv.delete).toHaveBeenCalledWith("ssr:/note/test");
    });

    it("silently ignores KV errors", async () => {
      kv.list.mockRejectedValue(new Error("KV error"));
      await expect(cache.invalidateAll()).resolves.toBeUndefined();
    });
  });
});

describe("SitemapCache", () => {
  let kv: ReturnType<typeof createMockKv>;
  let cache: SitemapCache;

  beforeEach(() => {
    kv = createMockKv();
    cache = new SitemapCache(kv as any);
  });

  describe("get", () => {
    it("returns cached sitemap XML", async () => {
      kv.get.mockResolvedValue("<urlset>...</urlset>");
      const result = await cache.get();
      expect(result).toBe("<urlset>...</urlset>");
      expect(kv.get).toHaveBeenCalledWith("seo:sitemap");
    });

    it("returns null on miss", async () => {
      kv.get.mockResolvedValue(null);
      const result = await cache.get();
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("stores sitemap with 1-hour TTL", async () => {
      await cache.set("<urlset>new</urlset>");
      expect(kv.put).toHaveBeenCalledWith("seo:sitemap", "<urlset>new</urlset>", {
        expirationTtl: 3600,
      });
    });
  });
});
