import { createServerOnlyFn } from "@tanstack/solid-start";
import { createServerApiClient } from "~/lib/create-api-client.ts";

export const getHealth = createServerOnlyFn(async () => {
  const client = createServerApiClient();
  const res = await client.health.$get();
  return await res.json();
});
