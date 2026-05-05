import type { Database } from "@/db/client";
import { TagRepo } from "@/db/repositories/tag.repo";
import type { CreateTagInput } from "@/shared/schemas/tag";

export class TagService {
  private tagRepo: TagRepo;

  constructor(db: Database) {
    this.tagRepo = new TagRepo(db);
  }

  async list() {
    return this.tagRepo.findAll();
  }

  async create(input: CreateTagInput) {
    const existing = await this.tagRepo.findBySlug(input.slug);
    if (existing) throw new TagSlugConflictError();

    return this.tagRepo.create({
      id: crypto.randomUUID(),
      name: input.name,
      slug: input.slug,
    });
  }

  async delete(tagId: string) {
    const existing = await this.tagRepo.findById(tagId);
    if (!existing) throw new TagNotFoundError();

    const noteCount = await this.tagRepo.countNotesForTag(tagId);
    if (noteCount > 0) {
      throw new TagInUseError();
    }

    return this.tagRepo.delete(tagId);
  }
}

export class TagSlugConflictError extends Error {
  constructor() {
    super("Tag slug already exists");
    this.name = "TagSlugConflictError";
  }
}

export class TagNotFoundError extends Error {
  constructor() {
    super("Tag not found");
    this.name = "TagNotFoundError";
  }
}

export class TagInUseError extends Error {
  constructor() {
    super("Tag is in use");
    this.name = "TagInUseError";
  }
}
