/**
 * Test fixtures for xAI API responses
 */

export const validChatResponse = {
  id: 'chatcmpl-abc123',
  object: 'chat.completion' as const,
  created: 1704067200,
  model: 'grok-4',
  choices: [
    {
      index: 0,
      message: { role: 'assistant' as const, content: 'Test response' },
      finish_reason: 'stop' as const,
    },
  ],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 100,
    total_tokens: 150,
  },
};

export const modelsListResponse = {
  object: 'list' as const,
  data: [
    { id: 'grok-4', object: 'model' as const, created: 1704067200, owned_by: 'xai' },
    { id: 'grok-4-fast', object: 'model' as const, created: 1704067200, owned_by: 'xai' },
    { id: 'grok-code-fast-1', object: 'model' as const, created: 1704067200, owned_by: 'xai' },
    { id: 'grok-4.1-fast', object: 'model' as const, created: 1704067200, owned_by: 'xai' },
  ],
};

export const errorResponses = {
  unauthorized: {
    error: { message: 'Invalid API key', type: 'invalid_api_key' },
  },
  rateLimited: {
    error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded' },
  },
  serverError: {
    error: { message: 'Internal server error', type: 'server_error' },
  },
  modelNotFound: {
    error: { message: 'Model not found', type: 'model_not_found' },
  },
};

/**
 * Model pricing data for cost calculation tests
 */
export const modelPricing = {
  'grok-4': { input_per_1m: 3.0, output_per_1m: 15.0 },
  'grok-4-fast': { input_per_1m: 0.5, output_per_1m: 2.0 },
  'grok-code-fast-1': { input_per_1m: 0.3, output_per_1m: 0.5 },
  'grok-4.1-fast': { input_per_1m: 0.6, output_per_1m: 2.5 },
};
