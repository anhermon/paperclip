import { describe, expect, it } from "vitest";
import { assembleHeartbeatInvocation } from "@paperclipai/adapter-utils";

describe("assembleHeartbeatInvocation", () => {
  it("preserves heartbeat context layers and appends prompt and adapter layers", () => {
    const result = assembleHeartbeatInvocation({
      context: {
        paperclipHeartbeatContext: {
          version: 1,
          layers: [
            {
              key: "identity",
              title: "Identity",
              kind: "context",
              summary: "Agent identity",
              metadata: { agentId: "agent-1" },
            },
          ],
        },
      },
      promptFragments: [
        {
          key: "bootstrap_prompt",
          title: "Bootstrap prompt",
          text: "Bootstrap",
          metricKey: "bootstrapPromptChars",
        },
        {
          key: "heartbeat_prompt",
          title: "Heartbeat prompt",
          text: "Continue work",
          metricKey: "heartbeatPromptChars",
        },
      ],
      adapterLayers: [
        {
          key: "adapter_extras",
          title: "Adapter-specific extras",
          summary: "Instructions injected separately",
          metadata: { injection: "append-system-prompt-file" },
        },
      ],
    });

    expect(result.prompt).toBe("Bootstrap\n\nContinue work");
    expect(result.promptMetrics).toEqual({
      bootstrapPromptChars: "Bootstrap".length,
      heartbeatPromptChars: "Continue work".length,
      promptChars: "Bootstrap\n\nContinue work".length,
    });
    expect(result.heartbeatLayers).toEqual([
      expect.objectContaining({
        key: "identity",
        kind: "context",
        summary: "Agent identity",
      }),
      expect.objectContaining({
        key: "bootstrap_prompt",
        kind: "prompt",
        includedInPrompt: true,
        chars: "Bootstrap".length,
      }),
      expect.objectContaining({
        key: "heartbeat_prompt",
        kind: "prompt",
        includedInPrompt: true,
        chars: "Continue work".length,
      }),
      expect.objectContaining({
        key: "adapter_extras",
        kind: "adapter",
        summary: "Instructions injected separately",
      }),
    ]);
  });

  it("drops malformed context layers and marks empty prompt fragments as skipped", () => {
    const result = assembleHeartbeatInvocation({
      context: {
        paperclipHeartbeatContext: {
          version: 1,
          layers: [
            {
              key: "",
              title: "Broken",
              kind: "context",
            },
            {
              key: "task_context",
              title: "Task context",
              kind: "context",
              summary: "ANGA-112",
            },
          ],
        },
      },
      promptFragments: [
        {
          key: "session_handoff",
          title: "Session handoff",
          text: "   ",
          metricKey: "sessionHandoffChars",
        },
      ],
    });

    expect(result.prompt).toBe("");
    expect(result.promptMetrics).toEqual({
      sessionHandoffChars: 0,
      promptChars: 0,
    });
    expect(result.heartbeatLayers).toEqual([
      expect.objectContaining({
        key: "task_context",
        kind: "context",
        summary: "ANGA-112",
      }),
      expect.objectContaining({
        key: "session_handoff",
        kind: "prompt",
        includedInPrompt: false,
        summary: "Session handoff skipped",
      }),
    ]);
  });
});
