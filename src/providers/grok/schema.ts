import { Option, Schema } from "effect";
import { trimmedNonEmptyStringSchema } from "../../shared/schema";

export const GrokUsageSchema = Schema.Struct({
  prompt_tokens: Schema.Number,
  completion_tokens: Schema.Number,
  total_tokens: Schema.Number,
});

export type GrokUsage = typeof GrokUsageSchema.Type;

export const GrokMessageSchema = Schema.Struct({
  role: Schema.Literals(["system", "user", "assistant"] as const),
  content: Schema.String,
});

export type GrokMessage = typeof GrokMessageSchema.Type;

export const GrokChatCompletionRequestSchema = Schema.Struct({
  model: Schema.NonEmptyString,
  stream: Schema.Boolean,
  messages: Schema.NonEmptyArray(GrokMessageSchema),
});

export type GrokChatCompletionRequest = typeof GrokChatCompletionRequestSchema.Type;

export const GrokChatCompletionResponseSchema = Schema.Struct({
  model: Schema.String,
  choices: Schema.NonEmptyArray(
    Schema.Struct({
      message: GrokMessageSchema,
    }),
  ),
  usage: GrokUsageSchema,
});

export type GrokChatCompletionResponse = typeof GrokChatCompletionResponseSchema.Type;

export class GrokSearchInput extends Schema.Class<GrokSearchInput>("GrokSearchInput")({
  query: trimmedNonEmptyStringSchema("query must be a non-empty string"),
  platform: Schema.Option(Schema.NonEmptyString),
  model: Schema.Option(Schema.NonEmptyString),
}) {
  static decodeEffect = Schema.decodeUnknownEffect(GrokSearchInput);
}

export interface GrokSearchResult {
  readonly content: string;
  readonly model: string;
  readonly usage: GrokUsage;
}

export const GrokSearchResultSchema = Schema.Struct({
  content: Schema.String,
  model: Schema.String,
  usage: GrokUsageSchema,
});

const timeSensitivePattern =
  /今天|最新|当前|latest|recent|today|current|now|这几天|本周|本月|近期|最近/iu;

export const grokSystemPrompt = `# Core Instruction

1. User needs may be vague. Think divergently, infer intent from multiple angles, and leverage full conversation context to progressively clarify their true needs.
2. **Breadth-First Search**—Approach problems from multiple dimensions. Brainstorm 5+ perspectives and execute parallel searches for each. Consult as many high-quality sources as possible before responding.
3. **Depth-First Search**—After broad exploration, select ≥2 most relevant perspectives for deep investigation into specialized knowledge.
4. **Evidence-Based Reasoning & Traceable Sources**—Every claim must be followed by a citation. More credible sources strengthen arguments. If no references exist, remain silent.
5. Before responding, ensure full execution of Steps 1–4.

# Search Instruction

1. Think carefully before responding—anticipate the user's true intent to ensure precision.
2. Verify every claim rigorously to avoid misinformation.
3. Follow problem logic—dig deeper until clues are exhaustively clear. Use multiple parallel tool calls per query and ensure answers are well-sourced.
4. Search in English first (prioritizing English resources for volume/quality), but switch to Chinese if context demands.
5. Prioritize authoritative sources: Wikipedia, academic databases, books, reputable media/journalism.
6. Favor sharing in-depth, specialized knowledge over generic or common-sense content.

# Output Style

1. Lead with the **most probable solution** before detailed analysis.
2. **Define every technical term** in plain language.
3. **Respect facts and search results—use statistical rigor to discern truth**.
4. **Every sentence must cite sources**. More references = stronger credibility.
5. **Strictly format outputs in polished Markdown**.`;

const withCurrentTimeContext = (query: string) => {
  if (!timeSensitivePattern.test(query)) {
    return query;
  }

  return `[Current date and time: ${new Date().toISOString()}]

${query}`;
};

export const buildGrokUserMessage = (input: GrokSearchInput) => {
  const baseMessage = withCurrentTimeContext(input.query);

  return Option.match(input.platform, {
    onNone: () => baseMessage,
    onSome: (platform) =>
      `${baseMessage}

You should focus on these platform: ${platform}`,
  });
};
