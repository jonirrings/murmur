import type { Database } from "@/db/client";
import { notes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Known bot user-agent substrings (case-insensitive check).
 */
const BOT_PATTERNS = [
  "bot",
  "crawler",
  "spider",
  "slurp",
  "mediapartners",
  "preview", // link previews (Slack, Discord, Telegram, etc.)
  "fetch",
  "curl",
  "wget",
  "python-requests",
  "go-http-client",
  "java/",
  "httpclient",
  "okhttp",
  "headlesschrome",
  "phantomjs",
  "selenium",
  "puppeteer",
  "playwright",
];

/**
 * Cloudflare bot score threshold (0-100, lower = more likely bot).
 * Requests with score below this are filtered out.
 */
const BOT_SCORE_THRESHOLD = 30;

export class ViewTrackerService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Check if a request is likely from a bot using Cloudflare headers
   * and user-agent analysis.
   */
  isBot(request: Request): boolean {
    // 1. Check Cloudflare bot management score
    const cfBotScore = request.headers.get("cf-bot-management-score");
    if (cfBotScore) {
      const score = parseFloat(cfBotScore);
      if (!isNaN(score) && score < BOT_SCORE_THRESHOLD) {
        return true;
      }
    }

    // 2. Check Cloudflare verified bot category
    const cfBotCategory = request.headers.get("cf-verified-bot-category");
    if (cfBotCategory && cfBotCategory !== "none") {
      return true;
    }

    // 3. Check user-agent
    const ua = (request.headers.get("user-agent") || "").toLowerCase();
    if (!ua || ua.length < 10) return true; // Empty or very short UA is suspicious

    for (const pattern of BOT_PATTERNS) {
      if (ua.includes(pattern)) return true;
    }

    return false;
  }

  /**
   * Increment view count for a note (only if not a bot).
   * Uses a conditional increment to avoid counting bots.
   */
  async incrementViewCount(noteId: string, request: Request): Promise<boolean> {
    if (this.isBot(request)) return false;

    try {
      await this.db
        .update(notes)
        .set({ viewCount: sql`${notes.viewCount} + 1` })
        .where(eq(notes.id, noteId))
        .execute();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set view count to a specific value (used for CF Analytics calibration).
   */
  async setViewCount(noteId: string, count: number): Promise<boolean> {
    try {
      await this.db.update(notes).set({ viewCount: count }).where(eq(notes.id, noteId)).execute();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Batch set view counts from CF Analytics data.
   * Accepts a map of slug → count and updates corresponding notes.
   */
  async batchSetViewCounts(viewData: Array<{ slug: string; views: number }>): Promise<number> {
    let updated = 0;
    for (const { slug, views } of viewData) {
      try {
        const result = await this.db
          .update(notes)
          .set({ viewCount: views })
          .where(eq(notes.slug, slug))
          .run();
        if (result.meta.changes > 0) updated++;
      } catch {
        // Skip invalid slugs
      }
    }
    return updated;
  }
}
