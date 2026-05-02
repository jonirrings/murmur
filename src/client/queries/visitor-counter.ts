import { useQuery } from "@tanstack/react-query";

interface VisitorCounts {
  [pageKey: string]: number;
}

async function fetchVisitorCounts(): Promise<VisitorCounts> {
  const res = await fetch("/api/visitor-counter/counts");
  if (!res.ok) return {};
  return res.json();
}

export function useSiteWideOnlineCount() {
  return useQuery({
    queryKey: ["visitor-counts"],
    queryFn: fetchVisitorCounts,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
