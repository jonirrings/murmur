import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const entries = [
  { href: "/admin/snippets", title: "碎片管理", description: "撰写、发布和管理碎碎念" },
  { href: "/admin/tags", title: "标签管理", description: "维护标签与颜色" },
];

export default function AdminHome() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">概览</h1>
        <p className="mt-1 text-sm text-muted-foreground">碎碎念 · 技术资料整合站</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <Link key={entry.href} href={entry.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{entry.title}</CardTitle>
                <CardDescription>{entry.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
