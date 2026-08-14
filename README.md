# @papercusp/scout-runtime

Provider-neutral backend runtime for Scout-style shopping agents. It owns the
bounded model/tool loop, retry policy, normalized usage, budget/telemetry hooks,
and provider adapters. Consuming applications own every product-domain concern:
prompts, identity, sessions, memory, persistence, catalog/cart implementations,
and app-specific stream events.

The package deliberately does not depend on `@papercusp/scout-chat`. That
package remains the browser drawer and transport; both meet only at the existing
`@papercusp/chat-protocol` wire contract in each application.

## Runtime seam

```ts
import { runScoutTurn, type ScoutTool } from '@papercusp/scout-runtime';
import { VertexGeminiAdapter } from '@papercusp/scout-runtime/vertex';

const model = new VertexGeminiAdapter({
  model: process.env.SCOUT_VERTEX_MODEL ?? 'gemini-3.1-pro-preview-customtools',
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'global',
});

const tools: ScoutTool<AppContext, AppEvent>[] = [
  {
    definition: {
      name: 'search_catalog',
      description: 'Search the application catalog.',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    },
    execute: async (args, context) => ({
      content: await context.catalog.search(String(args.query ?? '')),
      events: [],
    }),
  },
];

for await (const event of runScoutTurn({ model, messages, tools, context })) {
  // Map runtime tokens/tool status plus app events onto the app's existing wire union.
}
```

## Vertex authentication

`VertexGeminiAdapter` constructs `GoogleGenAI` with `vertexai: true`. It uses
Google Application Default Credentials and requires only project/location/model
configuration. Never place a service-account key or API key in this repository.

Standard configuration:

```text
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<project id>
GOOGLE_CLOUD_LOCATION=global
SCOUT_VERTEX_MODEL=gemini-3.1-pro-preview-customtools
```

The model is intentionally configurable because preview model identifiers move.

## Verification

```bash
npm test
npm run typecheck
```
