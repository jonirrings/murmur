import i18next from "i18next";

const ERROR_CODE_MAP: Record<string, string> = {
  INTERNAL_ERROR: "apiErrors.internalError",
  FORBIDDEN: "apiErrors.forbidden",
  UNAUTHORIZED: "apiErrors.unauthorized",
  NOT_FOUND: "apiErrors.notFound",
  RATE_LIMITED: "apiErrors.rateLimited",
  CONFLICT: "apiErrors.conflict",
  VALIDATION_ERROR: "apiErrors.internalError",
};

export function getLocalizedApiError(error: { code: string; message: string }): string {
  const t = i18next.getFixedT(i18next.language, "common");
  const key = ERROR_CODE_MAP[error.code];
  return key ? t(key) : error.message;
}
