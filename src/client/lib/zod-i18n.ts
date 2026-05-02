import { z } from "zod/v4";
import i18next from "i18next";

z.setErrorMap((issue) => {
  const t = i18next.getFixedT(i18next.language, "common");
  switch (issue.code) {
    case "too_small":
      return { message: t("validation.required") };
    case "too_big":
      return { message: t("validation.tooLong") };
    case "invalid_format":
      return { message: t("validation.invalidEmail") };
    default:
      return undefined;
  }
});
