import { describe, expect, it, vi } from 'vitest';
import { runScoutTurn, ScoutToolRoundLimitError } from './runner.js';
import type {
  ScoutMessage,
  ScoutModelAdapter,
  ScoutModelRequest,
  ScoutModelResponse,
  ScoutModelStreamEvent,
  ScoutTool,
} from './types.js';

class ScriptedModel implements ScoutModelAdapter {
  readonly model = 'test-model';
  readonly complete = vi.fn<(request: ScoutModelRequest) => Promise<ScoutModelResponse>>();
  readonly streamedRequests: ScoutModelRequest[] = [];

  constructor(responses: ScoutModelResponse[], private readonly tokens: string[] = ['done']) {
    for (const response of responses) this.complete.mockResolvedValueOnce(response);
  }

  async *stream(request: ScoutModelRequest): AsyncIterable<ScoutModelStreamEvent> {
    this.streamedRequests.push(request);
    for (const text of this.tokens) yield { type: 'text', text };
  }
}

describe('runScoutTurn', () => {
  it('executes application tools, records messages, and streams the final response', async () => {
    const model = new ScriptedModel([
      {
        content: '',
        toolCalls: [{ id: 'call-1', name: 'search_catalog', args: { query: 'kettle' } }],
        usage: { model: 'test-model', promptTokens: 10, completionTokens: 2 },
      },
      { content: 'I found one.', toolCalls: [] },
    ], ['I found ', 'one.']);
    const messages: ScoutMessage[] = [
      { role: 'system', content: 'Help the shopper.' },
      { role: 'user', content: 'Any kettles?' },
    ];
    const tool: ScoutTool<{ seller: string }, { type: 'products'; count: number }> = {
      definition: {
        name: 'search_catalog',
        description: 'Search products',
        inputSchema: { type: 'object' },
      },
      execute: async (args) => ({
        content: { products: [{ title: 'Harbor Kettle' }], query: args.query ?? null },
        events: [{ type: 'products' as const, count: 1 }],
      }),
    };
    const onUsage = vi.fn();
    const onTool = vi.fn();

    const events = [];
    for await (const event of runScoutTurn({
      model,
      messages,
      tools: [tool],
      context: { seller: 'demo' },
      hooks: { onUsage, onTool },
      forceToolOnFirstRound: true,
    })) events.push(event);

    expect(events).toEqual([
      { type: 'tool_start', name: 'search_catalog', callId: 'call-1' },
      { type: 'app', event: { type: 'products', count: 1 } },
      { type: 'token', content: 'I found ' },
      { type: 'token', content: 'one.' },
      { type: 'done' },
    ]);
    expect(messages.at(-2)).toMatchObject({
      role: 'tool',
      toolCallId: 'call-1',
      toolName: 'search_catalog',
    });
    expect(messages.at(-1)).toEqual({ role: 'assistant', content: 'I found one.' });
    expect(model.streamedRequests[0]?.toolChoice).toBe('none');
    expect(model.streamedRequests[0]?.messages.at(-1)).toEqual({
      role: 'user',
      content: 'The required tool results are complete. Answer the original user request in plain text using only those results. Do not call tools.',
    });
    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onTool).toHaveBeenCalledWith(expect.objectContaining({ ok: true }), { seller: 'demo' });
  });

  it('runs the budget hook before any provider call', async () => {
    const model = new ScriptedModel([]);
    const error = new Error('budget exhausted');
    const events = [];
    for await (const event of runScoutTurn({
      model,
      messages: [],
      tools: [],
      context: {},
      hooks: { beforeTurn: () => { throw error; } },
    })) events.push(event);

    expect(model.complete).not.toHaveBeenCalled();
    expect(events).toEqual([{ type: 'error', message: expect.any(String), cause: error }]);
  });

  it('streams application events while an interactive tool is still executing', async () => {
    const model = new ScriptedModel([
      {
        content: '',
        toolCalls: [{ id: 'choice-1', name: 'ask_choice', args: { prompt: 'Tea or coffee?' } }],
      },
      { content: 'Tea selected.', toolCalls: [] },
    ], ['Tea selected.']);
    const tool: ScoutTool<Record<string, never>, { type: 'card' | 'card_closed'; id: string }> = {
      definition: { name: 'ask_choice', inputSchema: { type: 'object' } },
      async *execute() {
        yield { type: 'card', id: 'card-1' };
        await Promise.resolve();
        yield { type: 'card_closed', id: 'card-1' };
        return { content: { answer: 'tea' } };
      },
    };

    const events = [];
    for await (const event of runScoutTurn({
      model,
      messages: [],
      tools: [tool],
      context: {},
    })) events.push(event);

    expect(events).toEqual([
      { type: 'tool_start', name: 'ask_choice', callId: 'choice-1' },
      { type: 'app', event: { type: 'card', id: 'card-1' } },
      { type: 'app', event: { type: 'card_closed', id: 'card-1' } },
      { type: 'token', content: 'Tea selected.' },
      { type: 'done' },
    ]);
  });

  it('ends with a typed error when the model never exits tool mode', async () => {
    const response = {
      content: '',
      toolCalls: [{ id: 'loop', name: 'noop', args: {} }],
    };
    const model = new ScriptedModel([response, response]);
    const events = [];
    for await (const event of runScoutTurn({
      model,
      messages: [],
      tools: [{
        definition: { name: 'noop', inputSchema: { type: 'object' } },
        execute: () => ({ content: { ok: true } }),
      }],
      context: {},
      maxToolRounds: 2,
    })) events.push(event);

    expect(events.at(-1)).toMatchObject({
      type: 'error',
      cause: expect.any(ScoutToolRoundLimitError),
    });
  });
});
