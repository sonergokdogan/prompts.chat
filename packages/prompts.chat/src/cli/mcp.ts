import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const DEFAULT_BASE_URL = 'https://prompts.chat';

interface RemoteJsonRpcSuccess<TResult> {
  jsonrpc: '2.0';
  id: number | string | null;
  result: TResult;
}

interface RemoteJsonRpcError {
  jsonrpc: '2.0';
  id: number | string | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type RemoteJsonRpcResponse<TResult> = RemoteJsonRpcSuccess<TResult> | RemoteJsonRpcError;

interface ToolCallResult {
  [key: string]: unknown;
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

interface McpRuntimeConfig {
  baseUrl: string;
  query: string;
  apiKey?: string;
}

function parseArgs(args: string[]): Partial<McpRuntimeConfig> {
  const parsed: Partial<McpRuntimeConfig> = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const nextArgument = args[index + 1];

    if ((argument === '--base-url' || argument === '--url') && nextArgument) {
      parsed.baseUrl = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith('--base-url=')) {
      parsed.baseUrl = argument.slice('--base-url='.length);
      continue;
    }

    if (argument.startsWith('--url=')) {
      parsed.baseUrl = argument.slice('--url='.length);
      continue;
    }

    if (argument === '--query' && nextArgument) {
      parsed.query = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith('--query=')) {
      parsed.query = argument.slice('--query='.length);
    }
  }

  return parsed;
}

function getRuntimeConfig(args: string[]): McpRuntimeConfig {
  const parsedArgs = parseArgs(args);
  const baseUrl = (parsedArgs.baseUrl || process.env.PROMPTS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const query = parsedArgs.query || process.env.PROMPTS_QUERY || '';
  const apiKey = process.env.PROMPTS_API_KEY;

  return {
    baseUrl,
    query,
    apiKey: apiKey && apiKey.trim().length > 0 ? apiKey : undefined,
  };
}

function buildEndpointUrl(config: McpRuntimeConfig): string {
  if (!config.query) {
    return `${config.baseUrl}/api/mcp`;
  }

  const trimmedQuery = config.query.replace(/^\?+/, '');
  return `${config.baseUrl}/api/mcp?${trimmedQuery}`;
}

let requestId = 0;

async function callRemoteMcp<TResult>(
  config: McpRuntimeConfig,
  method: string,
  params?: Record<string, unknown>
): Promise<TResult> {
  requestId += 1;

  const response = await fetch(buildEndpointUrl(config), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.apiKey ? { PROMPTS_API_KEY: config.apiKey } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`Remote MCP request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as RemoteJsonRpcResponse<TResult>;

  if ('error' in payload) {
    throw new Error(payload.error.message || 'Remote MCP request failed');
  }

  return payload.result;
}

function buildServer(config: McpRuntimeConfig): McpServer {
  const server = new McpServer(
    {
      name: 'prompts-chat',
      version: '1.0.0',
    },
    {
      capabilities: {
        prompts: { listChanged: false },
        tools: {},
      },
    }
  );

  server.server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
    const remoteResult = await callRemoteMcp<{
      prompts: Array<{
        name: string;
        title: string;
        description?: string;
        arguments?: Array<{
          name: string;
          description?: string;
          required?: boolean;
        }>;
      }>;
      nextCursor?: string;
    }>(config, 'prompts/list', request.params ? { cursor: request.params.cursor } : undefined);

    return remoteResult;
  });

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const remoteResult = await callRemoteMcp<{
      description?: string;
      messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: {
          type: 'text';
          text: string;
        };
      }>;
    }>(config, 'prompts/get', {
      name: request.params.name,
      arguments: request.params.arguments,
    });

    return remoteResult;
  });

  server.registerTool(
    'search_prompts',
    {
      title: 'Search Prompts',
      description:
        'Search for AI prompts by keyword. Returns matching prompts with title, description, content, author, category, and tags.',
      inputSchema: {
        query: z.string().describe('Search query to find relevant prompts'),
        limit: z.number().min(1).max(50).default(10).describe('Maximum number of prompts to return'),
        type: z.enum(['TEXT', 'STRUCTURED', 'IMAGE', 'VIDEO', 'AUDIO']).optional().describe('Filter by prompt type'),
        category: z.string().optional().describe('Filter by category slug'),
        tag: z.string().optional().describe('Filter by tag slug'),
      },
    },
    async ({ query, limit = 10, type, category, tag }) => {
      return callRemoteMcp<ToolCallResult>(config, 'tools/call', {
        name: 'search_prompts',
        arguments: { query, limit, type, category, tag },
      });
    }
  );

  server.registerTool(
    'get_prompt',
    {
      title: 'Get Prompt',
      description: 'Get a prompt by ID and optionally fill in its variables.',
      inputSchema: {
        id: z.string().describe('The ID of the prompt to retrieve'),
      },
    },
    async ({ id }) => {
      return callRemoteMcp<ToolCallResult>(config, 'tools/call', {
        name: 'get_prompt',
        arguments: { id },
      });
    }
  );

  server.registerTool(
    'save_prompt',
    {
      title: 'Save Prompt',
      description:
        'Save a new prompt to your prompts.chat account. Requires PROMPTS_API_KEY when running locally.',
      inputSchema: {
        title: z.string().min(1).max(200).describe('Title of the prompt'),
        content: z.string().min(1).describe('The prompt content'),
        description: z.string().max(500).optional().describe('Optional description of the prompt'),
        tags: z.array(z.string()).max(10).optional().describe('Optional array of tag names'),
        category: z.string().optional().describe('Optional category slug'),
        isPrivate: z.boolean().optional().describe('Override the default privacy setting'),
        type: z.enum(['TEXT', 'STRUCTURED', 'IMAGE', 'VIDEO', 'AUDIO']).optional().describe('Prompt type'),
        structuredFormat: z.enum(['JSON', 'YAML']).optional().describe('Format for structured prompts'),
      },
    },
    async ({ title, content, description, tags, category, isPrivate, type, structuredFormat }) => {
      return callRemoteMcp<ToolCallResult>(config, 'tools/call', {
        name: 'save_prompt',
        arguments: { title, content, description, tags, category, isPrivate, type, structuredFormat },
      });
    }
  );

  server.registerTool(
    'improve_prompt',
    {
      title: 'Improve Prompt',
      description: 'Transform a basic prompt into a well-structured, comprehensive prompt using AI.',
      inputSchema: {
        prompt: z.string().min(1).max(10000).describe('The prompt to improve'),
        outputType: z.enum(['text', 'image', 'video', 'sound']).default('text').describe('Content type'),
        outputFormat: z.enum(['text', 'structured_json', 'structured_yaml']).default('text').describe('Response format'),
      },
    },
    async ({ prompt, outputType = 'text', outputFormat = 'text' }) => {
      return callRemoteMcp<ToolCallResult>(config, 'tools/call', {
        name: 'improve_prompt',
        arguments: { prompt, outputType, outputFormat },
      });
    }
  );

  return server;
}

export async function runMcpServer(args: string[]): Promise<void> {
  const runtimeConfig = getRuntimeConfig(args);
  const server = buildServer(runtimeConfig);
  const transport = new StdioServerTransport();

  console.error(`prompts.chat MCP bridge connected to ${buildEndpointUrl(runtimeConfig)}`);

  await server.connect(transport);
}