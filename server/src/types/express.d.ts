import type { ErrorContext } from "../middleware/error-handler.js";

export {};

declare global {
  namespace Express {
    interface Request {
      actor: {
        type: "board" | "agent" | "none";
        userId?: string;
        agentId?: string;
        companyId?: string;
        companyIds?: string[];
        isInstanceAdmin?: boolean;
        keyId?: string;
        runId?: string;
        source?: "local_implicit" | "session" | "board_key" | "agent_key" | "agent_jwt" | "none";
      };
      /** Express router attaches the matched route here after routing. */
      route?: { path: string };
    }
    interface Response {
      /** Error context attached by the error handler for structured logging. */
      __errorContext?: ErrorContext;
      /** Raw error object attached by the error handler for pino-http access. */
      err?: Error;
    }
  }
}
