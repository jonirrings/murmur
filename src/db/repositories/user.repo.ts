import { eq, and, desc, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { user } from "@/db/schema";

export class UserRepo {
  constructor(private db: Database) {}

  async findById(id: string) {
    return this.db.select().from(user).where(eq(user.id, id)).get();
  }

  async findByEmail(email: string) {
    return this.db.select().from(user).where(eq(user.email, email)).get();
  }

  async countAdmins() {
    const result = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, "admin"))
      .get();
    return result ? 1 : 0;
  }

  async updateRole(id: string, role: "admin" | "author" | "commenter") {
    return this.db
      .update(user)
      .set({ role, updatedAt: new Date().toISOString() })
      .where(eq(user.id, id))
      .returning()
      .get();
  }

  async updateApprovalStatus(id: string, approvalStatus: "pending" | "approved" | "rejected") {
    return this.db
      .update(user)
      .set({ approvalStatus, updatedAt: new Date().toISOString() })
      .where(eq(user.id, id))
      .returning()
      .get();
  }

  async findPending() {
    return this.db.select().from(user).where(eq(user.approvalStatus, "pending")).all();
  }

  async findAll(
    page: number,
    limit: number,
    filters?: {
      approvalStatus?: "pending" | "approved" | "rejected";
      role?: "admin" | "author" | "commenter";
    },
  ) {
    const conditions = [];
    if (filters?.approvalStatus) conditions.push(eq(user.approvalStatus, filters.approvalStatus));
    if (filters?.role) conditions.push(eq(user.role, filters.role));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        approvalStatus: user.approvalStatus,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
  }

  async count(filters?: {
    approvalStatus?: "pending" | "approved" | "rejected";
    role?: "admin" | "author" | "commenter";
  }) {
    const conditions = [];
    if (filters?.approvalStatus) conditions.push(eq(user.approvalStatus, filters.approvalStatus));
    if (filters?.role) conditions.push(eq(user.role, filters.role));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(where)
      .get();
    return result?.count ?? 0;
  }
}
