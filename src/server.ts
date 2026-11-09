/**
 * aigifmaker-mcp: make animated GIFs from text on AI GIF Maker (aigifmaker.ai)
 * from any MCP client. Every tool goes through the public API with the
 * caller's own key, so a GIF costs the same credit as on the website.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { AigifmakerError, credentialsHint, credits, getStatus, hasApiKey, submit, waitFor } from './client.js';

const text = (body: string) => ({ content: [{ type: 'text' as const, text: body }] });
const fail = (body: string) => ({ ...text(body), isError: true as const });

function explain(e: unknown): string {
  if (!(e instanceof AigifmakerError)) return String(e);
  if (e.kind === 'auth' && !e.message.includes('apikeys')) return `${e.message}. ${credentialsHint}`;
  if (e.kind === 'rejected') return `${e.message}. Reword the prompt and try again.`;
  return e.message;
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'aigifmaker-mcp', version: '0.1.1' });

  server.registerTool(
    'generate_gif',
    {
      title: 'Generate an animated GIF',
      description:
        'Turn a text prompt into an animated GIF on AI GIF Maker (aigifmaker.ai) and return the GIF URL. Native GIF generation, no video conversion; usually about a minute. Costs 1 credit on the AI GIF Maker account behind AIGIFMAKER_API_KEY, the same as on the website.',
      inputSchema: {
        prompt: z.string().min(1).describe('What the GIF should show and how it moves, e.g. "a corgi in sunglasses dancing on a beach, looping".'),
      },
    },
    async ({ prompt }) => {
      if (!hasApiKey()) return fail(`No API key set. ${credentialsHint}`);
      try {
        const id = await submit(prompt);
        const url = await waitFor(id);
        return text(`GIF ready:\n\n${url}`);
      } catch (e) {
        return fail(`GIF not made: ${explain(e)}`);
      }
    }
  );

  server.registerTool(
    'check_gif',
    {
      title: 'Check a GIF that is still running',
      description:
        'Look up a GIF by the task id generate_gif returned when it was still running, and return its URL once it is ready. Free to call.',
      inputSchema: {
        task_id: z.string().min(1).describe('The task id from generate_gif.'),
      },
    },
    async ({ task_id }) => {
      if (!hasApiKey()) return fail(`No API key set. ${credentialsHint}`);
      try {
        const task = await getStatus(task_id);
        if (task.status === 'success' && task.images?.length) return text(`GIF ready:\n\n${task.images[0]}`);
        if (task.status === 'failed' || task.status === 'canceled') {
          return fail(`GIF not made: ${task.errorMessage || `the GIF ${task.status}`}`);
        }
        return text(`Task ${task_id} is still running. Check again in a minute.`);
      } catch (e) {
        return fail(`Could not check the GIF: ${explain(e)}`);
      }
    }
  );

  server.registerTool(
    'check_credits',
    {
      title: 'AI GIF Maker credit balance',
      description: 'Credits left on the AI GIF Maker account behind AIGIFMAKER_API_KEY. One GIF costs 1 credit. Free to call.',
      inputSchema: {},
    },
    async () => {
      if (!hasApiKey()) return fail(`No API key set. ${credentialsHint}`);
      try {
        const c = await credits();
        return text(`${c} credits left on your AI GIF Maker account (1 credit per GIF).`);
      } catch (e) {
        return fail(`Could not read credits: ${explain(e)}`);
      }
    }
  );

  return server;
}
