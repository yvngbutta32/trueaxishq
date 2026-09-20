import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

import type { inferRouterOutputs } from "@trpc/server";
export type RouterOutputs = inferRouterOutputs<AppRouter>;
