## 9. 前端工程化

### 9.1 Tailwind CSS v4（手写组件）

> **注意**：原设计使用 shadcn/ui + Radix UI，Phase 1-3 未引入，使用纯 Tailwind 工具类。后续可按需引入。

```css
/* src/client/styles.css — Tailwind CSS v4 入口 */
@import "tailwindcss";
```

```typescript
// vite.config.ts — Vite + Tailwind v4 + TanStack Router 集成
import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: resolve(__dirname, "src/client/routes"),
      generatedRouteTree: resolve(__dirname, "src/client/routeTree.gen.ts"),
    }),
    devServer({ entry: resolve(__dirname, "src/index.ts") }),
    react(),
    tailwindcss(),
    {
      name: "move-index-html",
      closeBundle() {
        // Vite preserves directory structure; copy index.html to dist/client root
        const src = resolve(__dirname, "dist/client/src/client/index.html");
        const dest = resolve(__dirname, "dist/client/index.html");
        mkdirSync(resolve(__dirname, "dist/client"), { recursive: true });
        copyFileSync(src, dest);
      },
    },
  ],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    rollupOptions: { input: resolve(__dirname, "src/client/index.html") },
  },
});
```

### 9.2 状态管理分层

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                       │
├──────────────────┬──────────────────────────────────────┤
│   Zustand        │         TanStack Query                │
│   (客户端状态)    │         (服务端状态)                   │
├──────────────────┼──────────────────────────────────────┤
│ • 编辑器状态      │ • 笔记列表（缓存 + 分页）              │
│ • 侧边栏开关      │ • 笔记详情（乐观更新）                 │
│ • 当前笔记 ID     │ • 评论列表（乐观更新）                 │
│ • 协作连接状态    │ • 用户列表（admin）                    │
│ • 光标颜色映射    │ • 标签列表                            │
│ • 主题偏好        │ • 认证状态                            │
├──────────────────┴──────────────────────────────────────┤
│              fetchApi (REST API 调用)                       │
└─────────────────────────────────────────────────────────┘
```

```typescript
// src/client/stores/ui-store.ts — Zustand store（含 locale）
import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18next from "i18next";

type Locale = "zh-CN" | "en";

interface UiState {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  locale: Locale;
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLocale: (locale: Locale) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "system",
      locale: "zh-CN",
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => {
        i18next.changeLanguage(locale);
        document.documentElement.lang = locale;
        set({ locale });
      },
    }),
    { name: "murmur-ui" },
  ),
);
```

```typescript
// src/client/queries/notes.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useNotes(category?: string) {
  return useQuery({
    queryKey: ["notes", { category }],
    queryFn: () => api.notes.list({ category }),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateNoteInput) => api.notes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
```

### 9.3 Zod Schema 前后端共享

```typescript
// src/shared/schemas/comment.ts
import { z } from "zod";

export const createCommentSchema = z.object({
  content: z.string().min(1).max(200, "评论不超过 200 字符"),
  noteId: z.string(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// 前端：React Hook Form 校验
// const form = useForm({ resolver: zodResolver(createCommentSchema) });

// 后端：Hono 路由校验
// app.post('/api/notes/:noteId/comments', zValidator('json', createCommentSchema), handler);
```

---
