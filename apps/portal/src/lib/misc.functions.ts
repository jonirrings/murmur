import { createServerFn } from "@tanstack/solid-start";
import { getHealth } from "~/lib/misc.server.ts";

export const healthStatus = createServerFn({ method: "GET" }).handler(getHealth);
