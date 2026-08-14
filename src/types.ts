export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type ScoutMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ScoutToolCall {
  id: string;
  name: string;
  args: JsonObject;
}

export interface ScoutMessage {
  role: ScoutMessageRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: ScoutToolCall[];
}

export interface ScoutUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  totalTokens?: number;
}

export interface ScoutToolDefinition {
  name: string;
  description?: string;
  inputSchema: JsonObject;
}

export type ScoutToolChoice = 'auto' | 'required' | 'none';

export interface ScoutModelRequest {
  messages: readonly ScoutMessage[];
  tools: readonly ScoutToolDefinition[];
  toolChoice?: ScoutToolChoice;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ScoutModelResponse {
  content: string;
  toolCalls: ScoutToolCall[];
  usage?: ScoutUsage;
  finishReason?: string;
}

export type ScoutModelStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'usage'; usage: ScoutUsage };

export interface ScoutModelAdapter {
  readonly model: string;
  complete(request: ScoutModelRequest): Promise<ScoutModelResponse>;
  stream(request: ScoutModelRequest): AsyncIterable<ScoutModelStreamEvent>;
}

export interface ScoutToolResult<TAppEvent> {
  content: JsonValue;
  events?: readonly TAppEvent[];
  ok?: boolean;
}

export type ScoutToolExecution<TAppEvent> =
  | ScoutToolResult<TAppEvent>
  | Promise<ScoutToolResult<TAppEvent>>
  | AsyncGenerator<TAppEvent, ScoutToolResult<TAppEvent>, void>;

export interface ScoutTool<TContext, TAppEvent> {
  definition: ScoutToolDefinition;
  execute(
    args: JsonObject,
    context: TContext,
    call: ScoutToolCall,
  ): ScoutToolExecution<TAppEvent>;
}

export interface ScoutRuntimeHooks<TContext> {
  beforeTurn?(context: TContext): Promise<void> | void;
  onMessage?(message: ScoutMessage, context: TContext): Promise<void> | void;
  onUsage?(usage: ScoutUsage, context: TContext): Promise<void> | void;
  onTool?(result: {
    call: ScoutToolCall;
    ok: boolean;
    durationMs: number;
  }, context: TContext): Promise<void> | void;
  onError?(error: unknown, context: TContext): Promise<void> | void;
}

export type ScoutRuntimeEvent<TAppEvent> =
  | { type: 'tool_start'; name: string; callId: string }
  | { type: 'token'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string; cause: unknown }
  | { type: 'app'; event: TAppEvent };

export interface RunScoutTurnOptions<TContext, TAppEvent> {
  model: ScoutModelAdapter;
  messages: ScoutMessage[];
  tools: readonly ScoutTool<TContext, TAppEvent>[];
  context: TContext;
  hooks?: ScoutRuntimeHooks<TContext>;
  maxToolRounds?: number;
  forceToolOnFirstRound?: boolean;
  streamFinalResponse?: boolean;
  temperature?: number;
  signal?: AbortSignal;
  errorMessage?: string;
}
