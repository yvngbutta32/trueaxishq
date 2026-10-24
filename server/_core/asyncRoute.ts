/* Express 4 does NOT catch async rejections: an async route handler that
 * throws mid-request never reaches the global error middleware, and the
 * socket hangs until the client gives up (Node keeps it open indefinitely).
 *
 * This was first caught live on the voice webhooks (fixed with
 * withGracefulVoice in server/voiceApi.ts). asyncRoute is the general form
 * for every other Express router: any rejection is routed to next(err), so
 * the existing global error handler answers with an honest 500 instead of
 * dead air. Every async route registration in this codebase must go through
 * it — pinned by server/asyncRouteCoverage.test.ts.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";

export const asyncRoute =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
