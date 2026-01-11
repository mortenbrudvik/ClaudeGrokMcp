/**
 * grok_search_x Tool Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateGrokSearchXInput, grokSearchXSchema } from './search-x.js';

describe('grok_search_x tool', () => {
  describe('schema', () => {
    it('should have correct name', () => {
      expect(grokSearchXSchema.type).toBe('object');
    });

    it('should require query', () => {
      expect(grokSearchXSchema.required).toContain('query');
    });

    it('should have x_search enabled by default', () => {
      expect(grokSearchXSchema.properties.enable_x_search.default).toBe(true);
    });

    it('should have web_search disabled by default', () => {
      expect(grokSearchXSchema.properties.enable_web_search.default).toBe(false);
    });
  });

  describe('validateGrokSearchXInput', () => {
    it('should validate minimal input', () => {
      const result = validateGrokSearchXInput({ query: 'test query' });
      expect(result.query).toBe('test query');
      expect(result.enable_x_search).toBe(true);
      expect(result.enable_web_search).toBe(false);
      expect(result.max_turns).toBe(3);
    });

    it('should validate full input', () => {
      const input = {
        query: 'test query',
        enable_x_search: true,
        enable_web_search: true,
        max_turns: 5,
        x_handles: ['handle1', 'handle2'],
        from_date: '2024-01-01',
        to_date: '2024-12-31',
        domains: ['example.com'],
        include_citations: false,
      };
      const result = validateGrokSearchXInput(input);
      expect(result.query).toBe('test query');
      expect(result.enable_x_search).toBe(true);
      expect(result.enable_web_search).toBe(true);
      expect(result.max_turns).toBe(5);
      expect(result.x_handles).toEqual(['handle1', 'handle2']);
      expect(result.include_citations).toBe(false);
    });

    it('should throw on missing query', () => {
      expect(() => validateGrokSearchXInput({})).toThrow('query required');
    });

    it('should throw on non-object input', () => {
      expect(() => validateGrokSearchXInput(null)).toThrow('Input must be object');
      expect(() => validateGrokSearchXInput('string')).toThrow('Input must be object');
    });
  });
});

describe('handleGrokSearchX', () => {
  // Mock client
  const mockClient = {
    responsesCreate: vi.fn(),
    calculateCost: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.calculateCost.mockReturnValue({
      estimated_usd: 0.001,
      input_tokens: 100,
      output_tokens: 200,
      model: 'grok-4-1-fast',
    });
    mockClient.responsesCreate.mockResolvedValue({
      id: 'resp-123',
      content: 'Search results summary',
      model: 'grok-4-1-fast',
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      citations: [{ url: 'https://example.com', title: 'Example' }],
      server_side_tool_usage: { x_search: 1 },
    });
  });

  it('should execute search with default settings', async () => {
    const { handleGrokSearchX } = await import('./search-x.js');
    const result = await handleGrokSearchX(mockClient as any, { query: 'test query' });

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Search Results');
    expect(mockClient.responsesCreate).toHaveBeenCalled();
  });

  it('should include citations in response', async () => {
    const { handleGrokSearchX } = await import('./search-x.js');
    const result = await handleGrokSearchX(mockClient as any, {
      query: 'test query',
      include_citations: true,
    });

    expect(result.content[0].text).toContain('Sources:');
    expect(result.content[0].text).toContain('Example');
  });

  it('should exclude citations when disabled', async () => {
    const { handleGrokSearchX } = await import('./search-x.js');
    const result = await handleGrokSearchX(mockClient as any, {
      query: 'test query',
      include_citations: false,
    });

    expect(result.content[0].text).not.toContain('Sources:');
  });

  it('should handle errors gracefully', async () => {
    mockClient.responsesCreate.mockRejectedValue(new Error('API error'));

    const { handleGrokSearchX } = await import('./search-x.js');
    const result = await handleGrokSearchX(mockClient as any, { query: 'test query' });

    expect(result.content[0].text).toContain('Search failed');
    expect(result.content[0].text).toContain('API error');
  });

  it('should fail when no search type enabled', async () => {
    const { handleGrokSearchX } = await import('./search-x.js');
    const result = await handleGrokSearchX(mockClient as any, {
      query: 'test query',
      enable_x_search: false,
      enable_web_search: false,
    });

    expect(result.content[0].text).toContain('Search failed');
    expect(result.content[0].text).toContain('Enable at least one search type');
  });

  it('should include metadata in response', async () => {
    const { handleGrokSearchX } = await import('./search-x.js');
    const result = await handleGrokSearchX(mockClient as any, { query: 'test query' });

    expect(result.content[0].text).toContain('Model: grok-4-1-fast');
    expect(result.content[0].text).toContain('Tokens: 300');
    expect(result.content[0].text).toContain('Cost: $');
  });

  it('should use services when provided', async () => {
    const mockServices = {
      costTracker: {
        checkBudget: vi.fn(),
        addFromEstimate: vi.fn(),
      },
      rateLimiter: {
        acquire: vi.fn().mockResolvedValue(undefined),
        recordUsage: vi.fn(),
        clearBackoff: vi.fn(),
      },
    };

    const { handleGrokSearchX } = await import('./search-x.js');
    await handleGrokSearchX(mockClient as any, { query: 'test' }, mockServices as any);

    expect(mockServices.costTracker.checkBudget).toHaveBeenCalled();
    expect(mockServices.rateLimiter.acquire).toHaveBeenCalled();
  });
});
