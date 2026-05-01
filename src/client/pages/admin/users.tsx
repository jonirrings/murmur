import { useState } from "react";
import { useAllUsers, useUpdateApproval, useUpdateRole } from "@/client/queries/admin";

export function AdminUsers() {
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<
    "pending" | "approved" | "rejected" | undefined
  >(undefined);
  const [filterRole, setFilterRole] = useState<
    "admin" | "author" | "commenter" | undefined
  >(undefined);

  const { data, isLoading } = useAllUsers({
    page,
    limit: 20,
    approvalStatus: filterStatus,
    role: filterRole,
  });
  const updateApproval = useUpdateApproval();
  const updateRole = useUpdateRole();

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "已通过";
      case "pending":
        return "待审批";
      case "rejected":
        return "已拒绝";
      default:
        return status;
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "管理员";
      case "author":
        return "作者";
      case "commenter":
        return "评论者";
      default:
        return role;
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        用户管理
      </h2>

      <div className="mb-4 flex items-center gap-4">
        <select
          value={filterStatus ?? ""}
          onChange={(e) => {
            setFilterStatus(
              e.target.value as "pending" | "approved" | "rejected" | undefined || undefined,
            );
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">全部状态</option>
          <option value="pending">待审批</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>

        <select
          value={filterRole ?? ""}
          onChange={(e) => {
            setFilterRole(
              e.target.value as "admin" | "author" | "commenter" | undefined || undefined,
            );
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">全部角色</option>
          <option value="admin">管理员</option>
          <option value="author">作者</option>
          <option value="commenter">评论者</option>
        </select>

        <span className="text-sm text-gray-500">共 {total} 人</span>
      </div>

      {isLoading ? (
        <p className="text-gray-400">加载中...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-400">暂无用户</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 px-3 text-left font-medium text-gray-500">用户</th>
                <th className="py-2 px-3 text-left font-medium text-gray-500">邮箱</th>
                <th className="py-2 px-3 text-left font-medium text-gray-500">角色</th>
                <th className="py-2 px-3 text-left font-medium text-gray-500">状态</th>
                <th className="py-2 px-3 text-left font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      {u.image ? (
                        <img
                          src={u.image}
                          alt=""
                          className="h-6 w-6 rounded-full"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                          {u.name?.charAt(0) ?? "?"}
                        </div>
                      )}
                      <span className="text-gray-900 dark:text-gray-100">
                        {u.name ?? "—"}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                    {u.email}
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        updateRole.mutate({
                          id: u.id,
                          role: e.target.value as "admin" | "author" | "commenter",
                        })
                      }
                      disabled={updateRole.isPending}
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="admin">管理员</option>
                      <option value="author">作者</option>
                      <option value="commenter">评论者</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusBadge(u.approvalStatus)}`}
                    >
                      {statusLabel(u.approvalStatus)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {u.approvalStatus === "pending" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            updateApproval.mutate({
                              id: u.id,
                              approvalStatus: "approved",
                            })
                          }
                          disabled={updateApproval.isPending}
                          className="rounded px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50"
                        >
                          通过
                        </button>
                        <button
                          onClick={() =>
                            updateApproval.mutate({
                              id: u.id,
                              approvalStatus: "rejected",
                            })
                          }
                          disabled={updateApproval.isPending}
                          className="rounded px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50"
                        >
                          拒绝
                        </button>
                      </div>
                    )}
                    {u.approvalStatus === "rejected" && (
                      <button
                        onClick={() =>
                          updateApproval.mutate({
                            id: u.id,
                            approvalStatus: "approved",
                          })
                        }
                        disabled={updateApproval.isPending}
                        className="rounded px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50"
                      >
                        重新通过
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            上一页
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
