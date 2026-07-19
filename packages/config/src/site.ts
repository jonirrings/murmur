export const siteConfig = {
    title: "Murmur — 碎碎念",
    description: "Short technical notes and TILs",
    domain: "m.o0x0o.com",
    author: "JonirRings",
    language: "zh-CN",
    apiBase: "https://m.o0x0o.com",
} as const;

export function isInternalLink(href: string): boolean {
    return href.startsWith("/") || href.startsWith("https://m.o0x0o.com");
}