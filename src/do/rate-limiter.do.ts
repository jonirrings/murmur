interface RateCheckRequest {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateCheckResponse {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface BucketEntry {
  ts: number;
  count: number;
}

export class RateLimiterDO implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/check" && request.method === "POST") {
      return this.handleCheck(request);
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleCheck(request: Request): Promise<Response> {
    let body: RateCheckRequest;
    try {
      body = (await request.json()) as RateCheckRequest;
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      );
    }

    const { key, limit, windowMs } = body;
    if (!key || !limit || !windowMs) {
      return Response.json(
        { error: "Missing required fields: key, limit, windowMs" },
        { status: 400 },
      );
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    const storageKey = `bucket:${key}`;

    const stored = (await this.state.storage.get<BucketEntry[]>(storageKey)) ?? [];

    // Prune entries outside the window
    const active = stored.filter((entry) => entry.ts > windowStart);

    const currentCount = active.reduce((sum, entry) => sum + entry.count, 0);

    if (currentCount >= limit) {
      await this.ensureAlarm(now, windowMs);
      const resetAt =
        active.length > 0
          ? Math.min(...active.map((e) => e.ts)) + windowMs
          : now + windowMs;

      const response: RateCheckResponse = {
        allowed: false,
        remaining: 0,
        resetAt,
      };
      return Response.json(response);
    }

    // Increment: bucket by minute
    const currentMinute = Math.floor(now / 60_000) * 60_000;
    const existing = active.find((e) => e.ts === currentMinute);
    if (existing) {
      existing.count += 1;
    } else {
      active.push({ ts: currentMinute, count: 1 });
    }

    await this.state.storage.put(storageKey, active);
    await this.ensureAlarm(now, windowMs);

    const response: RateCheckResponse = {
      allowed: true,
      remaining: limit - currentCount - 1,
      resetAt: currentMinute + windowMs,
    };
    return Response.json(response);
  }

  private async ensureAlarm(now: number, windowMs: number): Promise<void> {
    const existingAlarm = await this.state.storage.getAlarm();
    if (existingAlarm === null) {
      await this.state.storage.setAlarm(now + Math.max(windowMs, 60_000));
    }
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const maxAge = 3_600_000; // Keep entries for max 1 hour
    const list = await this.state.storage.list({ prefix: "bucket:" });
    for await (const [key, value] of list) {
      const entries = value as BucketEntry[];
      const active = entries.filter((e) => e.ts > now - maxAge);
      if (active.length === 0) {
        await this.state.storage.delete(key);
      } else {
        await this.state.storage.put(key, active);
      }
    }

    // Re-schedule alarm if there are still entries
    const remaining = await this.state.storage.list({ prefix: "bucket:" });
    let hasEntries = false;
    for await (const _ of remaining) {
      hasEntries = true;
      break;
    }
    if (hasEntries) {
      await this.state.storage.setAlarm(now + 3_600_000);
    }
  }
}
