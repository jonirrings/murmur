/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

interface PaginationProps {
  currentPage: number;
  total: number;
  pageSize: number;
  basePath: string;
  nextPageLabel: string;
}

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  total,
  pageSize,
  basePath,
  nextPageLabel,
}) => {
  if (total <= pageSize) return <></>;
  return (
    <nav class="pagination">
      <a href={`${basePath}?page=${currentPage + 1}`}>{nextPageLabel}</a>
    </nav>
  );
};
