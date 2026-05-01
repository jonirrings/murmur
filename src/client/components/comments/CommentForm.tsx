import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateComment } from "@/client/queries/comments";

const commentSchema = z.object({
  content: z.string().min(1, "评论不能为空").max(2000, "评论最多 2000 字"),
});

type CommentFormInput = z.infer<typeof commentSchema>;

interface CommentFormProps {
  noteId: string;
}

export function CommentForm({ noteId }: CommentFormProps) {
  const createComment = useCreateComment(noteId);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CommentFormInput>({
    resolver: zodResolver(commentSchema),
  });

  const onSubmit = async (values: CommentFormInput) => {
    try {
      await createComment.mutateAsync(values);
      reset();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <textarea
          {...register("content")}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="写下你的评论..."
        />
        {errors.content && (
          <p className="mt-1 text-xs text-red-500">{errors.content.message}</p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {createComment.isError && "评论失败，请稍后重试"}
        </span>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "提交中..." : "发表评论"}
        </button>
      </div>
    </form>
  );
}
