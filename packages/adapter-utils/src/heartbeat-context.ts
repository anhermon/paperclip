import { joinPromptSections } from "./server-utils.js";
import type { AdapterInvocationLayer } from "./types.js";

export interface HeartbeatPromptFragment {
  key: string;
  title: string;
  text?: string | null;
  metricKey?: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AssembleHeartbeatInvocationInput {
  context?: Record<string, unknown> | null;
  promptFragments?: HeartbeatPromptFragment[];
  adapterLayers?: Array<{
    key: string;
    title: string;
    summary?: string | null;
    chars?: number;
    includedInPrompt?: boolean;
    metadata?: Record<string, unknown> | null;
  }>;
}

export interface AssembleHeartbeatInvocationResult {
  prompt: string;
  promptMetrics: Record<string, number>;
  heartbeatLayers: AdapterInvocationLayer[];
}

type RawHeartbeatLayer = {
  key?: unknown;
  title?: unknown;
  kind?: unknown;
  summary?: unknown;
  chars?: unknown;
  includedInPrompt?: unknown;
  metadata?: unknown;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asLayer(value: unknown): AdapterInvocationLayer | null {
  const raw = asObject(value) as RawHeartbeatLayer | null;
  if (!raw) return null;
  const key = typeof raw.key === "string" ? raw.key.trim() : "";
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const kind = raw.kind === "prompt" || raw.kind === "adapter" ? raw.kind : "context";
  if (!key || !title) return null;

  return {
    key,
    title,
    kind,
    summary: typeof raw.summary === "string" && raw.summary.trim().length > 0 ? raw.summary.trim() : null,
    chars: typeof raw.chars === "number" && Number.isFinite(raw.chars) ? raw.chars : undefined,
    includedInPrompt: raw.includedInPrompt === true,
    metadata: asObject(raw.metadata) ?? null,
  };
}

function readContextLayers(context: Record<string, unknown> | null | undefined): AdapterInvocationLayer[] {
  const heartbeatContext = asObject(context?.paperclipHeartbeatContext);
  const rawLayers = Array.isArray(heartbeatContext?.layers) ? heartbeatContext.layers : [];
  return rawLayers
    .map((value) => asLayer(value))
    .filter((value): value is AdapterInvocationLayer => value !== null);
}

function defaultPromptSummary(title: string, chars: number): string {
  return chars > 0 ? `${title} included (${chars} chars)` : `${title} skipped`;
}

export function assembleHeartbeatInvocation(
  input: AssembleHeartbeatInvocationInput,
): AssembleHeartbeatInvocationResult {
  const heartbeatLayers: AdapterInvocationLayer[] = [...readContextLayers(input.context)];
  const promptFragments = input.promptFragments ?? [];
  const promptSections = promptFragments.map((fragment) =>
    typeof fragment.text === "string" ? fragment.text.trim() : "",
  );

  const promptMetrics = Object.fromEntries(
    promptFragments
      .filter((fragment) => typeof fragment.metricKey === "string" && fragment.metricKey.trim().length > 0)
      .map((fragment, index) => [fragment.metricKey as string, promptSections[index]?.length ?? 0]),
  );

  for (let index = 0; index < promptFragments.length; index += 1) {
    const fragment = promptFragments[index];
    const text = promptSections[index] ?? "";
    heartbeatLayers.push({
      key: fragment.key,
      title: fragment.title,
      kind: "prompt",
      summary: fragment.summary ?? defaultPromptSummary(fragment.title, text.length),
      chars: text.length,
      includedInPrompt: text.length > 0,
      metadata: fragment.metadata ?? null,
    });
  }

  for (const layer of input.adapterLayers ?? []) {
    heartbeatLayers.push({
      key: layer.key,
      title: layer.title,
      kind: "adapter",
      summary: layer.summary ?? null,
      chars: layer.chars,
      includedInPrompt: layer.includedInPrompt,
      metadata: layer.metadata ?? null,
    });
  }

  const prompt = joinPromptSections(promptSections);
  promptMetrics.promptChars = prompt.length;

  return {
    prompt,
    promptMetrics,
    heartbeatLayers,
  };
}
