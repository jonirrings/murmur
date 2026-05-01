export const ROLE_HIERARCHY: Record<string, number> = {
  admin: 3,
  author: 2,
  commenter: 1,
} as const;

export const NOTE_CATEGORIES = ["note", "inspiration", "tip", "knowledge"] as const;

export const COMMENTS_PER_PAGE = 20;
export const NOTES_PER_PAGE = 20;
export const PREVIEW_SESSION_TTL_HOURS = 24;
export const AUTO_SAVE_DEBOUNCE_MS = 3000;
