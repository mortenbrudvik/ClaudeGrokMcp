import { http, HttpResponse } from 'msw';
const BASE_URL = 'https://api.x.ai/v1';
// Sample response data - matches actual xAI API model names
const mockModelsResponse = {
    object: 'list',
    data: [
        { id: 'grok-4-0709', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-4-fast-non-reasoning', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-code-fast-1', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-4-1-fast-reasoning', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-3', object: 'model', created: 1704067200, owned_by: 'xai' },
        { id: 'grok-2-vision-1212', object: 'model', created: 1704067200, owned_by: 'xai' },
    ],
};
const mockChatResponse = {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1704067200,
    model: 'grok-4-0709',
    choices: [
        {
            index: 0,
            message: { role: 'assistant', content: 'Mock response from Grok' },
            finish_reason: 'stop',
        },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
};
export const handlers = [
    // List models - using /models endpoint (actual xAI API)
    http.get(`${BASE_URL}/models`, () => {
        return HttpResponse.json(mockModelsResponse);
    }),
    // Chat completion
    http.post(`${BASE_URL}/chat/completions`, async ({ request }) => {
        const body = (await request.json());
        return HttpResponse.json({
            ...mockChatResponse,
            model: body.model || 'grok-4',
        });
    }),
];
// Error handlers for testing error scenarios
export const errorHandlers = {
    unauthorized: http.post(`${BASE_URL}/chat/completions`, () => {
        return HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 });
    }),
    rateLimited: http.post(`${BASE_URL}/chat/completions`, () => {
        return HttpResponse.json({ error: { message: 'Rate limit exceeded' } }, { status: 429, headers: { 'Retry-After': '5' } });
    }),
    serverError: http.post(`${BASE_URL}/chat/completions`, () => {
        return HttpResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
    }),
    modelNotFound: http.post(`${BASE_URL}/chat/completions`, () => {
        return HttpResponse.json({ error: { message: 'Model not found' } }, { status: 404 });
    }),
};
// Export mock data for use in tests
export const mockData = {
    modelsResponse: mockModelsResponse,
    chatResponse: mockChatResponse,
};
//# sourceMappingURL=handlers.js.map