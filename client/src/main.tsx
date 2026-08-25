import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// ─── Hardened QueryClient ─────────────────────────────────────────────────────
// Retry up to 3 times on transient failures, but never on auth/forbidden errors
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          const code = error.data?.code;
          if (
            code === "UNAUTHORIZED" ||
            code === "FORBIDDEN" ||
            code === "NOT_FOUND" ||
            code === "BAD_REQUEST"
          ) {
            return false;
          }
        }
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError) {
          const code = error.data?.code;
          if (
            code === "UNAUTHORIZED" ||
            code === "FORBIDDEN" ||
            code === "BAD_REQUEST"
          ) {
            return false;
          }
        }
        return failureCount < 2;
      },
    },
  },
});

// ─── Auth redirect on 401 ─────────────────────────────────────────────────────
const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  if (error.message === UNAUTHED_ERR_MSG) {
    window.location.href = getLoginUrl();
  }
};

const isExpectedPortalRecoveryError = (error: unknown) =>
  error instanceof TRPCClientError &&
  error.data?.code === "NOT_FOUND" &&
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/portal/");

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    if (isExpectedPortalRecoveryError(error)) {
      console.info("[Portal Recovery]", "Invalid or expired portal link rendered its recovery state.");
    } else {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.mutation.state.error);
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

// ─── tRPC client ──────────────────────────────────────────────────────────────
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
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
