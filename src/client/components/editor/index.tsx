import React from "react";

export { Toolbar } from "./Toolbar";
export { CollabPresence } from "./CollabPresence";

export const LazyMarkdownEditor = React.lazy(() =>
  import("./MarkdownEditor").then((m) => ({ default: m.MarkdownEditor })),
);
export type { MarkdownEditorHandle } from "./MarkdownEditor";

export const LazyImageUploader = React.lazy(() =>
  import("./ImageUploader").then((m) => ({
    default: m.ImageUploader,
  })),
);
// imagePasteExtension removed from barrel — import directly from "./ImageUploader" if needed
// (kept out to avoid pulling @codemirror/view into the initial chunk)
