import type { QueryClient } from "@tanstack/react-query";

/** Cancel in-flight reads before evicting account data, including unscoped keys. */
export async function clearAccountQueries(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  queryClient.removeQueries();
}
