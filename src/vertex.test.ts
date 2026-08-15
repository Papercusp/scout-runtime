import { describe, expect, it, vi } from 'vitest';
import { VertexGeminiAdapter } from './vertex.js';
import type { ScoutModelRequest } from './types.js';

function request(): ScoutModelRequest {
  return {
    messages: [
      { role: 'system', content: 'You are Scout.' },
      { role: 'user', content: 'Find a kettle.' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{
          id: 'call-1',
          name: 'search_catalog',
          args: { query: 'kettle' },
          providerMetadata: { thoughtSignature: 'prior-signature' },
        }],
      },
      {
        role: 'tool',
        content: '{"products":["Harbor Kettle"]}',
        toolCallId: 'call-1',
        toolName: 'search_catalog',
      },
    ],
    tools: [{
      name: 'search_catalog',
      description: 'Search products',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    }],
    toolChoice: 'auto',
  };
}

describe('VertexGeminiAdapter', () => {
  it('uses Vertex content/function shapes and normalizes the response', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: '',
      functionCalls: [{ id: 'next', name: 'search_catalog', args: { query: 'electric kettle' } }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3, totalTokenCount: 15 },
      candidates: [{
        finishReason: 'STOP',
        content: {
          parts: [{
            functionCall: { id: 'next', name: 'search_catalog', args: { query: 'electric kettle' } },
            thoughtSignature: 'next-signature',
          }],
        },
      }],
    });
    const adapter = new VertexGeminiAdapter({
      model: 'gemini-test',
      client: { models: { generateContent } as never },
      retryPolicy: {
        maxAttempts: 1,
        baseDelayMs: 0,
        maxDelayMs: 0,
        jitterRatio: 0,
        shouldRetry: () => false,
      },
    });

    await expect(adapter.complete(request())).resolves.toEqual({
      content: '',
      toolCalls: [{
        id: 'next',
        name: 'search_catalog',
        args: { query: 'electric kettle' },
        providerMetadata: { thoughtSignature: 'next-signature' },
      }],
      usage: { model: 'gemini-test', promptTokens: 12, completionTokens: 3, totalTokens: 15 },
      finishReason: 'STOP',
    });
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gemini-test',
      config: expect.objectContaining({
        systemInstruction: 'You are Scout.',
        tools: [{
          functionDeclarations: [expect.objectContaining({
            name: 'search_catalog',
            parametersJsonSchema: expect.objectContaining({ type: 'object' }),
          })],
        }],
      }),
      contents: expect.arrayContaining([
        expect.objectContaining({
          role: 'model',
          parts: [expect.objectContaining({
            thoughtSignature: 'prior-signature',
            functionCall: expect.objectContaining({ id: 'call-1', name: 'search_catalog' }),
          })],
        }),
        expect.objectContaining({
          role: 'user',
          parts: [expect.objectContaining({
            functionResponse: expect.objectContaining({ name: 'search_catalog', id: 'call-1' }),
          })],
        }),
      ]),
    }));
  });

  it('streams text and final usage', async () => {
    async function* chunks() {
      yield { text: 'Harbor ', usageMetadata: undefined };
      yield {
        text: 'Kettle',
        usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 2, totalTokenCount: 10 },
      };
    }
    const generateContentStream = vi.fn().mockResolvedValue(chunks());
    const adapter = new VertexGeminiAdapter({
      model: 'gemini-test',
      client: { models: { generateContentStream } as never },
    });

    const events = [];
    for await (const event of adapter.stream({ ...request(), toolChoice: 'none' })) events.push(event);
    expect(events).toEqual([
      { type: 'text', text: 'Harbor ' },
      { type: 'text', text: 'Kettle' },
      {
        type: 'usage',
        usage: { model: 'gemini-test', promptTokens: 8, completionTokens: 2, totalTokens: 10 },
      },
    ]);
  });
});
