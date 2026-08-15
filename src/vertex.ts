import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import { DEFAULT_RETRY_POLICY, withRetry, type RetryNotice, type RetryPolicy } from './retry.js';
import type {
  JsonObject,
  JsonValue,
  ScoutMessage,
  ScoutModelAdapter,
  ScoutModelRequest,
  ScoutModelResponse,
  ScoutModelStreamEvent,
  ScoutToolCall,
  ScoutUsage,
} from './types.js';

export interface VertexGeminiAdapterOptions {
  model: string;
  project?: string;
  location?: string;
  apiVersion?: string;
  retryPolicy?: RetryPolicy;
  onRetry?: (notice: RetryNotice) => Promise<void> | void;
  client?: Pick<GoogleGenAI, 'models'>;
}

export class VertexGeminiAdapter implements ScoutModelAdapter {
  readonly model: string;
  private readonly client: Pick<GoogleGenAI, 'models'>;
  private readonly retryPolicy: RetryPolicy;
  private readonly onRetry: VertexGeminiAdapterOptions['onRetry'];

  constructor(options: VertexGeminiAdapterOptions) {
    if (!options.model.trim()) throw new Error('Vertex Gemini model is required');
    this.model = options.model;
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.onRetry = options.onRetry;
    this.client = options.client ?? new GoogleGenAI({
      vertexai: true,
      ...(options.project ? { project: options.project } : {}),
      location: options.location ?? 'global',
      httpOptions: { apiVersion: options.apiVersion ?? 'v1' },
    });
  }

  async complete(request: ScoutModelRequest): Promise<ScoutModelResponse> {
    const params = this.toGenerateParams(request);
    const response = await withRetry(
      () => this.client.models.generateContent(params),
      this.retryPolicy,
      this.onRetry,
    );
    return normalizeResponse(response, this.model);
  }

  async *stream(request: ScoutModelRequest): AsyncGenerator<ScoutModelStreamEvent, void> {
    const params = this.toGenerateParams(request);
    const response = await withRetry(
      () => this.client.models.generateContentStream(params),
      this.retryPolicy,
      this.onRetry,
    );
    let lastUsageFingerprint = '';
    for await (const chunk of response) {
      if (chunk.text) yield { type: 'text', text: chunk.text };
      const usage = normalizeUsage(chunk, this.model);
      if (usage) {
        const fingerprint = JSON.stringify(usage);
        if (fingerprint !== lastUsageFingerprint) {
          lastUsageFingerprint = fingerprint;
          yield { type: 'usage', usage };
        }
      }
    }
  }

  private toGenerateParams(request: ScoutModelRequest) {
    const { systemInstruction, contents } = toVertexContents(request.messages);
    const exposesTools = request.toolChoice !== 'none' && request.tools.length > 0;
    const config: GenerateContentConfig = {
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(exposesTools ? {
        tools: [{ functionDeclarations: request.tools.map(toFunctionDeclaration) }],
        toolConfig: {
          functionCallingConfig: {
            mode: toFunctionCallingMode(request.toolChoice ?? 'auto'),
          },
        },
      } : {}),
      automaticFunctionCalling: { disable: true },
    };
    return {
      model: this.model,
      contents,
      config,
    };
  }
}

function toFunctionDeclaration(tool: ScoutModelRequest['tools'][number]): FunctionDeclaration {
  return {
    name: tool.name,
    ...(tool.description ? { description: tool.description } : {}),
    parametersJsonSchema: tool.inputSchema,
  };
}

function toFunctionCallingMode(choice: NonNullable<ScoutModelRequest['toolChoice']>): FunctionCallingConfigMode {
  if (choice === 'required') return FunctionCallingConfigMode.ANY;
  if (choice === 'none') return FunctionCallingConfigMode.NONE;
  return FunctionCallingConfigMode.AUTO;
}

function toVertexContents(messages: readonly ScoutMessage[]): {
  systemInstruction: string;
  contents: Content[];
} {
  const systemInstruction = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .filter(Boolean)
    .join('\n\n');

  const contents: Content[] = [];
  let pendingToolParts: Part[] = [];
  const flushToolParts = () => {
    if (pendingToolParts.length === 0) return;
    contents.push({ role: 'user', parts: pendingToolParts });
    pendingToolParts = [];
  };
  for (const message of messages) {
    if (message.role === 'system') continue;
    if (message.role === 'tool') {
      pendingToolParts.push({
        functionResponse: {
          name: message.toolName ?? 'tool',
          ...(message.toolCallId ? { id: message.toolCallId } : {}),
          response: parseToolResponse(message.content),
        },
      });
      continue;
    }

    flushToolParts();

    const parts: Part[] = [];
    if (message.content) parts.push({ text: message.content });
    for (const call of message.toolCalls ?? []) {
      const thoughtSignature = call.providerMetadata?.thoughtSignature;
      parts.push({
        functionCall: { id: call.id, name: call.name, args: call.args },
        ...(typeof thoughtSignature === 'string' ? { thoughtSignature } : {}),
      });
    }
    if (parts.length > 0) {
      contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts });
    }
  }
  flushToolParts();
  return { systemInstruction, contents };
}

function normalizeResponse(response: GenerateContentResponse, model: string): ScoutModelResponse {
  const usage = normalizeUsage(response, model);
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return {
    content: parts.length > 0
      ? parts.map((part) => part.text ?? '').join('')
      : response.text ?? '',
    toolCalls: normalizeFunctionCalls(response, parts),
    ...(usage ? { usage } : {}),
    ...(response.candidates?.[0]?.finishReason
      ? { finishReason: String(response.candidates[0].finishReason) }
      : {}),
  };
}

function normalizeFunctionCalls(
  response: GenerateContentResponse,
  parts: readonly Part[],
): ScoutToolCall[] {
  const signedCalls = parts.flatMap((part) => part.functionCall
    ? [{ call: part.functionCall, thoughtSignature: part.thoughtSignature }]
    : []);
  if (signedCalls.length > 0) {
    return signedCalls.map(({ call, thoughtSignature }, index) =>
      normalizeFunctionCall(call, index, thoughtSignature));
  }
  return (response.functionCalls ?? []).map((call, index) => normalizeFunctionCall(call, index));
}

function normalizeFunctionCall(
  call: FunctionCall,
  index: number,
  thoughtSignature?: string,
): ScoutToolCall {
  return {
    id: call.id ?? `${call.name ?? 'tool'}-${index}`,
    name: call.name ?? 'tool',
    args: asJsonObject(call.args),
    ...(thoughtSignature
      ? { providerMetadata: { thoughtSignature } }
      : {}),
  };
}

function normalizeUsage(response: GenerateContentResponse, model: string): ScoutUsage | undefined {
  const usage = response.usageMetadata;
  if (!usage) return undefined;
  return {
    model,
    promptTokens: usage.promptTokenCount ?? 0,
    completionTokens: usage.candidatesTokenCount ?? 0,
    ...(usage.cachedContentTokenCount === undefined
      ? {}
      : { cachedTokens: usage.cachedContentTokenCount }),
    ...(usage.totalTokenCount === undefined ? {} : { totalTokens: usage.totalTokenCount }),
  };
}

function parseToolResponse(content: string): JsonObject {
  try {
    const value: unknown = JSON.parse(content);
    return asJsonObject(value);
  } catch {
    return { result: content };
  }
}

function asJsonObject(value: unknown): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonObject;
  return { result: (value ?? null) as JsonValue };
}
