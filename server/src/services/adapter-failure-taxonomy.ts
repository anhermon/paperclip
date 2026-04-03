import type { AdapterFailureCategory } from "@paperclipai/adapter-utils";

/**
 * Map an adapter-emitted errorCode to the canonical AdapterFailureCategory.
 * Adapters emit canonical codes directly (e.g. "auth_required", "rate_limited").
 * Legacy provider-prefixed codes (e.g. "claude_auth_required") are kept for
 * backwards compatibility with older adapter versions but are deprecated.
 */
export function categorizeAdapterError(errorCode: string | null | undefined): AdapterFailureCategory {
  if (!errorCode) return "unknown";
  switch (errorCode) {
    case "auth_required":
    case "claude_auth_required": // @deprecated — use "auth_required"
    case "gemini_auth_required": // @deprecated — use "auth_required"
      return "auth_required";
    case "rate_limited":
    case "claude_rate_limited": // @deprecated — use "rate_limited"
      return "rate_limited";
    case "session_invalid":
    case "claude_session_invalid": // @deprecated — use "session_invalid"
      return "session_invalid";
    case "startup_failed":
    case "startup_failure": // @deprecated — use "startup_failed"
      return "startup_failed";
    case "timeout":
      return "timeout";
    case "provider_unavailable":
      return "provider_unavailable";
    case "process_lost":
    case "process_detached": // @deprecated — use "process_lost"
      return "process_lost";
    case "crash_no_output":
    case "claude_crash_no_output": // @deprecated — use "crash_no_output"
      return "crash_no_output";
    case "parse_error":
    case "claude_json_parse_failed": // @deprecated — use "parse_error"
      return "parse_error";
    case "cancelled":
      return "cancelled";
    case "nonzero_exit":
      return "nonzero_exit";
    case "all_adapters_exhausted":
      // All adapters in the fallback chain were tried and failed
      return "unknown";
    default:
      return "unknown";
  }
}
