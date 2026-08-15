import type {
  JsonObject,
  RunScoutTurnOptions,
  ScoutMessage,
  ScoutRuntimeEvent,
  ScoutTool,
  ScoutToolCall,
  ScoutToolExecution,
  ScoutToolResult,
  ScoutUsage,
} from './types.js';

const DEFAULT_MAX_TOOL_ROUNDS = 6;
const DEFAULT_ERROR_MESSAGE = 'Sorry, something went wrong. Please try again.';
const FINAL_RESPONSE_INSTRUCTION =
  'The required tool results are complete. Answer the original user request in plain text using only those results. Do not call tools.';

export class ScoutToolRoundLimitError extends Error {
  constructor(readonly maxToolRounds: number) {
    super(`Scout exceeded the ${maxToolRounds}-round tool-call limit`);
    this.name = 'ScoutToolRoundLimitError';
  }
}

export async function* runScoutTurn<TContext, TAppEvent>(
  options: RunScoutTurnOptions<TContext, TAppEvent>,
): AsyncGenerator<ScoutRuntimeEvent<TAppEvent>, void> {
  const maxToolRounds = options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  if (!Number.isInteger(maxToolRounds) || maxToolRounds < 1) {
    throw new RangeError('maxToolRounds must be a positive integer');
  }

  const toolByName = new Map(options.tools.map((tool) => [tool.definition.name, tool]));

  try {
    throwIfAborted(options.signal);
    await options.hooks?.beforeTurn?.(options.context);

    for (let round = 0; round < maxToolRounds; round += 1) {
      throwIfAborted(options.signal);
      const response = await options.model.complete({
        messages: options.messages,
        tools: options.tools.map((tool) => tool.definition),
        toolChoice: options.forceToolOnFirstRound && round === 0 ? 'required' : 'auto',
        ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      });
      await recordUsage(response.usage, options);

      if (response.toolCalls.length > 0) {
        await appendMessage({
          role: 'assistant',
          content: response.content,
          toolCalls: response.toolCalls,
        }, options);

        for (const call of response.toolCalls) {
          const tool = toolByName.get(call.name);
          if (!tool) throw new Error(`Model requested unknown Scout tool: ${call.name}`);
          yield { type: 'tool_start', name: call.name, callId: call.id };
          yield* executeTool(tool, call, options);
        }
        continue;
      }

      const fullContent = options.streamFinalResponse === false
        ? response.content
        : yield* streamFinalResponse(options);

      if (options.streamFinalResponse === false && fullContent) {
        yield { type: 'token', content: fullContent };
      }
      await appendMessage({ role: 'assistant', content: fullContent }, options);
      yield { type: 'done' };
      return;
    }

    throw new ScoutToolRoundLimitError(maxToolRounds);
  } catch (error) {
    await options.hooks?.onError?.(error, options.context);
    yield {
      type: 'error',
      message: options.errorMessage ?? DEFAULT_ERROR_MESSAGE,
      cause: error,
    };
  }
}

async function* executeTool<TContext, TAppEvent>(
  tool: ScoutTool<TContext, TAppEvent>,
  call: ScoutToolCall,
  options: RunScoutTurnOptions<TContext, TAppEvent>,
): AsyncGenerator<ScoutRuntimeEvent<TAppEvent>, void> {
  const startedAt = Date.now();
  let ok = false;
  let content: unknown;
  try {
    const execution = tool.execute(call.args, options.context, call);
    let result: ScoutToolResult<TAppEvent>;
    if (isStreamingToolExecution(execution)) {
      while (true) {
        const step = await execution.next();
        if (step.done) {
          result = step.value;
          break;
        }
        yield { type: 'app', event: step.value };
      }
    } else {
      result = await execution;
    }
    ok = result.ok ?? true;
    content = result.content;
    for (const event of result.events ?? []) yield { type: 'app', event };
  } catch (error) {
    content = { error: error instanceof Error ? error.message : String(error) };
  }

  await options.hooks?.onTool?.({
    call,
    ok,
    durationMs: Math.max(0, Date.now() - startedAt),
  }, options.context);

  await appendMessage({
    role: 'tool',
    content: stringifyToolContent(content),
    toolCallId: call.id,
    toolName: call.name,
  }, options);
}

function isStreamingToolExecution<TAppEvent>(
  execution: ScoutToolExecution<TAppEvent>,
): execution is AsyncGenerator<TAppEvent, ScoutToolResult<TAppEvent>, void> {
  return typeof execution === 'object'
    && execution !== null
    && Symbol.asyncIterator in execution
    && typeof execution.next === 'function';
}

async function* streamFinalResponse<TContext, TAppEvent>(
  options: RunScoutTurnOptions<TContext, TAppEvent>,
): AsyncGenerator<ScoutRuntimeEvent<TAppEvent>, string> {
  let content = '';
  const messages = options.messages.some((message) => message.role === 'tool')
    ? [...options.messages, { role: 'user' as const, content: FINAL_RESPONSE_INSTRUCTION }]
    : options.messages;
  const stream = options.model.stream({
    messages,
    tools: options.tools.map((tool) => tool.definition),
    toolChoice: 'none',
    ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });

  for await (const event of stream) {
    throwIfAborted(options.signal);
    if (event.type === 'usage') {
      await recordUsage(event.usage, options);
      continue;
    }
    content += event.text;
    yield { type: 'token', content: event.text };
  }
  return content;
}

async function appendMessage<TContext, TAppEvent>(
  message: ScoutMessage,
  options: RunScoutTurnOptions<TContext, TAppEvent>,
): Promise<void> {
  options.messages.push(message);
  await options.hooks?.onMessage?.(message, options.context);
}

async function recordUsage<TContext, TAppEvent>(
  usage: ScoutUsage | undefined,
  options: RunScoutTurnOptions<TContext, TAppEvent>,
): Promise<void> {
  if (usage) await options.hooks?.onUsage?.(usage, options.context);
}

function stringifyToolContent(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value ?? null);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
}

export function asJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonObject;
}
