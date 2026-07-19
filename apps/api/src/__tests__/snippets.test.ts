// __tests__/snippets.test.ts
import { describe, it, expect } from "vite-plus/test";
import app from "../index";
import { Response } from "@cloudflare/workers-types";

describe("GET /api/public/snippets", () => {
    it("returns 200 with paginated published snippets", async () => {
        const res = await app.request("/api/public/snippets?page=1&pageSize=10");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toBeInstanceOf(Array);
        expect(typeof body.total).toBe("number");
    });

    it("excludes draft/archived from public list", async () => {
        const res = await app.request("/api/public/snippets");
        const body = await res.json();
        for (const item of body.items) {
            expect(item.status).toBeUndefined();
        }
    });
});

describe("GET /api/public/snippets/:slug", () => {
    it("returns snippet detail with contentMd", async () => { /* ... */ });
    it("returns 404 for nonexistent slug", async () => { /* ... */ });
    it("returns markdown when ?format=md", async () => { /* ... */ });
});

describe("POST /api/admin/snippets (auth)", () => {
    it("rejects unauthenticated with 401", async () => { /* ... */ });
});

describe("Rate Limiting", () => {
    it("returns 429 after exceeding per-IP limit", async () => {
        const requests = Array.from({ length: 11 }, () =>
            app.request("/auth/login", { method: "POST" })
        );
        const results = await Promise.all(requests);
        expect(results.some((r:Response) => r.status === 429)).toBe(true);
    });

    it("sets X-RateLimit-* headers", async () => {
        const res = await app.request("/api/public/snippets");
        expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
        expect(res.headers.get("X-RateLimit-Remaining")).toBeTruthy();
    });
});