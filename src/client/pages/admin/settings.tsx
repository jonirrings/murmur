import { useState, useEffect } from "react";
import { useAdminSettings, useUpdateSettings } from "@/client/queries/admin";

const DEFAULT_SETTINGS: Record<string, string> = {
  site_title: "Murmur",
  site_description: "一个安静的笔记空间",
  comment_moderation_enabled: "true",
  posts_per_page: "10",
  comments_per_page: "20",
  allow_registration: "true",
};

export function AdminSettings() {
  const { data: settings, isLoading } = useAdminSettings();
  const updateSettings = useUpdateSettings();
  const [form, setForm] = useState<Record<string, string>>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({ ...DEFAULT_SETTINGS, ...settings });
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSettings.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) {
    return <p className="text-gray-400">加载中...</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        站点设置
      </h2>

      <div className="max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            站点标题
          </label>
          <input
            type="text"
            value={form.site_title ?? ""}
            onChange={(e) => setForm({ ...form, site_title: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            站点描述
          </label>
          <textarea
            rows={3}
            value={form.site_description ?? ""}
            onChange={(e) =>
              setForm({ ...form, site_description: e.target.value })
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.comment_moderation_enabled === "true"}
              onChange={(e) =>
                setForm({
                  ...form,
                  comment_moderation_enabled: e.target.checked ? "true" : "false",
                })
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              启用评论审核
            </span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            开启后，评论需要作者审核后才会显示
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            每页笔记数
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={form.posts_per_page ?? "10"}
            onChange={(e) => setForm({ ...form, posts_per_page: e.target.value })}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            每页评论数
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={form.comments_per_page ?? "20"}
            onChange={(e) => setForm({ ...form, comments_per_page: e.target.value })}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.allow_registration === "true"}
              onChange={(e) =>
                setForm({
                  ...form,
                  allow_registration: e.target.checked ? "true" : "false",
                })
              }
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              允许新用户注册
            </span>
          </label>
          <p className="mt-1 text-xs text-gray-500">
            关闭后，新用户将无法通过魔法链接注册
          </p>
        </div>

        <div className="pt-4">
          <button
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateSettings.isPending ? "保存中..." : "保存设置"}
          </button>
          {saved && (
            <span className="ml-3 text-sm text-green-600">已保存</span>
          )}
        </div>
      </div>
    </div>
  );
}
