import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import { workspaceStaffMemberships } from "../../drizzle/schema";
import { getDb } from "../db";
import type { TrpcContext } from "./context";

// Shared error formatter:
// - Validation failures surface the first zod issue as a human-readable message
//   (client toasts show this verbatim — never raw JSON issue arrays).
// - Unexpected 5xx faults never leak internals: default drizzle messages contain
//   the full SQL statement and bound params. Mask in production, keep details for
//   dev, and always log the real cause server-side so operators can diagnose.
// Pure message logic, unit-tested in server/trpcErrorFormatter.test.ts. The
// tRPC-integrated wrapper below keeps its shape so router type inference stays intact.
export function trpcErrorMessage(
  original: string,
  code: string,
  path: string | undefined,
  issues: { path?: (string | number)[]; message: string }[] | undefined,
  isProduction = process.env.NODE_ENV === "production",
): string {
  if (code === "INTERNAL_SERVER_ERROR") {
    console.error("[tRPC 500] " + String(path ?? "(no path)") + ": " + original);
    if (isProduction) {
      return "Something went wrong on our end. Please try again.";
    }
    return original;
  }
  if (Array.isArray(issues) && issues.length > 0) {
    const first = issues[0];
    const field = (first.path ?? []).join(".");
    return field ? field + ": " + first.message : first.message;
  }
  return original;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, path }) {
    return { ...shape, message: trpcErrorMessage(shape.message, error.code, path, (error.cause as { issues?: { path?: (string | number)[]; message: string }[] } | undefined)?.issues) };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const rejectActiveStaffMember = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database temporarily unavailable. Please try again." });
  }

  const [membership] = await db.select({ id: workspaceStaffMemberships.id })
    .from(workspaceStaffMemberships)
    .where(and(
      eq(workspaceStaffMemberships.memberUserId, ctx.user.id),
      eq(workspaceStaffMemberships.active, true),
    ))
    .limit(1);

  if (membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This account has staff access. Use the staff workspace." });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// General product procedures are for workspace owners. A dedicated staff procedure
// is used only by the deliberately limited staff-access router below.
export const protectedProcedure = t.procedure.use(requireUser).use(rejectActiveStaffMember);
export const staffProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// ownerProcedure — restricted to locally managed administrators.
export const ownerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
