import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import { installConfiguredAnalytics } from "./lib/analytics";
import { SERVICE_WORKER_VERSION } from "./lib/serviceWorkerVersion";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Always revalidate the worker script so installed copies promptly receive
    // startup-flow fixes, including the removal of the legacy sign-in screen.
    // Query-versioning defeats intermediary static-worker caches while keeping
    // the worker scope stable. The script still validates network freshness.
    void navigator.serviceWorker
      .register(
        `/api/service-worker-${SERVICE_WORKER_VERSION.replace("studentos-", "")}.js`,
        { scope: "/", updateViaCache: "none" }
      )
      .catch(error =>
        console.warn("Service worker registration failed", error)
      );
  });
}

installConfiguredAnalytics();

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Student OS authentication is cookie-bound. Do not read or forward a
        // session value from browser storage, including inside an embedded preview.
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
