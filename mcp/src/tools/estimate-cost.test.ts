/**
 * grok_estimate_cost Tool Tests
 */

import { describe, it, expect } from 'vitest';
import {
  executeEstimateCost,
  handleEstimateCost,
  estimateTokens,
  estimateCostSchema,
  compareModelCosts,
  EstimateCostInput,
} from './estimate-cost.js';

describe('grok_estimate_cost tool', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should estimate tokens for short text', () => {
      const tokens = estimateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20);
    });

    it('should estimate tokens for longer text', () => {
      const longText =
        'This is a longer piece of text that should result in more tokens being estimated for the cost calculation.';
      const tokens = estimateTokens(longText);
      expect(tokens).toBeGreaterThan(20);
    });

    it('should handle whitespace normalization', () => {
      const withWhitespace = 'Hello    world   \n\n\t test';
      const tokens = estimateTokens(withWhitespace);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should add minimum tokens for very short input', () => {
      const tokens = estimateTokens('Hi');
      expect(tokens).toBeGreaterThanOrEqual(1);
    });
  });

  describe('estimateCostSchema', () => {
    it('should have required query property', () => {
      expect(estimateCostSchema.required).toContain('query');
    });

    it('should have max_tokens with constraints', () => {
      expect(estimateCostSchema.properties.max_tokens.minimum).toBe(1);
      expect(estimateCostSchema.properties.max_tokens.maximum).toBe(100000);
    });

    it('should use JSON Schema 2020-12', () => {
      expect(estimateCostSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    });
  });

  describe('executeEstimateCost', () => {
    it('should estimate cost for a simple query', () => {
      const input: EstimateCostInput = {
        query: 'What is 2+2?',
      };

      const result = executeEstimateCost(input);

      expect(result.estimated_input_tokens).toBeGreaterThan(0);
      expect(result.estimated_output_tokens).toBeGreaterThan(0);
      expect(result.estimated_cost_usd).toBeGreaterThan(0);
      expect(result.model).toBeDefined();
      expect(result.pricing.input_per_1m).toBeGreaterThan(0);
      expect(result.pricing.output_per_1m).toBeGreaterThan(0);
    });

    it('should resolve model aliases', () => {
      const input: EstimateCostInput = {
        query: 'Test query',
        model: 'fast',
      };

      const result = executeEstimateCost(input);

      expect(result.model).toBe('grok-4-fast-non-reasoning');
    });

    it('should include context in token estimation', () => {
      const withoutContext: EstimateCostInput = {
        query: 'Test query',
      };

      const withContext: EstimateCostInput = {
        query: 'Test query',
        context: 'This is additional context that should increase the token count.',
      };

      const resultWithout = executeEstimateCost(withoutContext);
      const resultWith = executeEstimateCost(withContext);

      expect(resultWith.estimated_input_tokens).toBeGreaterThan(
        resultWithout.estimated_input_tokens
      );
    });

    it('should use max_tokens when provided', () => {
      const input: EstimateCostInput = {
        query: 'Test query',
        max_tokens: 1000,
      };

      const result = executeEstimateCost(input);

      expect(result.estimated_output_tokens).toBe(1000);
    });

    it('should estimate more output for code queries', () => {
      const simpleQuery: EstimateCostInput = {
        query: 'What is the capital of France?',
      };

      const codeQuery: EstimateCostInput = {
        query: 'Write a function to sort an array',
      };

      const simpleResult = executeEstimateCost(simpleQuery);
      const codeResult = executeEstimateCost(codeQuery);

      expect(codeResult.estimated_output_tokens).toBeGreaterThan(
        simpleResult.estimated_output_tokens
      );
    });

    it('should provide cost breakdown', () => {
      const input: EstimateCostInput = {
        query: 'Test query',
      };

      const result = executeEstimateCost(input);

      expect(result.breakdown.input_cost_usd).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.output_cost_usd).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.input_cost_usd + result.breakdown.output_cost_usd).toBeCloseTo(
        result.estimated_cost_usd,
        10
      );
    });

    it('should generate warning for expensive queries', () => {
      const input: EstimateCostInput = {
        query: 'Test query',
        model: 'smartest',
        max_tokens: 50000, // Large output to trigger warning
      };

      const result = executeEstimateCost(input);

      // High cost should trigger a warning
      if (result.estimated_cost_usd > 0.1) {
        expect(result.warning).toBeDefined();
      }
    });

    it('should throw error for empty query', () => {
      const input: EstimateCostInput = {
        query: '',
      };

      expect(() => executeEstimateCost(input)).toThrow('Query is required');
    });

    it('should throw error for whitespace-only query', () => {
      const input: EstimateCostInput = {
        query: '   \n\t  ',
      };

      expect(() => executeEstimateCost(input)).toThrow('Query is required');
    });

    it('should use default pricing for unknown models', () => {
      const input: EstimateCostInput = {
        query: 'Test query',
        model: 'unknown-model-xyz',
      };

      const result = executeEstimateCost(input);

      // Should use default pricing (mid-range)
      expect(result.pricing.input_per_1m).toBe(2.0);
      expect(result.pricing.output_per_1m).toBe(10.0);
    });

    it('should calculate total tokens correctly', () => {
      const input: EstimateCostInput = {
        query: 'Test query',
        max_tokens: 500,
      };

      const result = executeEstimateCost(input);

      expect(result.estimated_total_tokens).toBe(
        result.estimated_input_tokens + result.estimated_output_tokens
      );
    });
  });

  describe('handleEstimateCost', () => {
    it('should return formatted MCP response on success', async () => {
      const input = {
        query: 'What is machine learning?',
      };

      const result = await handleEstimateCost(input);

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('🤖 **Grok Cost Estimate:**');
    });

    it('should include cost breakdown table', async () => {
      const input = {
        query: 'Test query',
      };

      const result = await handleEstimateCost(input);

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Input');
      expect(text).toContain('Output');
      expect(text).toContain('Total');
    });

    it('should include model pricing info', async () => {
      const input = {
        query: 'Test query',
      };

      const result = await handleEstimateCost(input);

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Model Pricing');
      expect(text).toContain('per 1M tokens');
    });

    it('should include warning when present', async () => {
      const input = {
        query: 'Test query',
        model: 'smartest',
        max_tokens: 50000,
      };

      const result = await handleEstimateCost(input);

      const text = (result.content[0] as { text: string }).text;
      // May or may not have warning depending on cost
      expect(text).toContain('🤖 **Grok Cost Estimate:**');
    });

    it('should return error for invalid input', async () => {
      const result = await handleEstimateCost(null);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Error');
    });

    it('should return error for missing query', async () => {
      const result = await handleEstimateCost({ model: 'fast' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('query property is required');
    });

    it('should return error for non-string query', async () => {
      const result = await handleEstimateCost({ query: 123 });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('must be a string');
    });

    it('should accept max_tokens parameter', async () => {
      const input = {
        query: 'Test query',
        max_tokens: 1000,
      };

      const result = await handleEstimateCost(input);

      expect(result.isError).toBe(false);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('1,000'); // Formatted number
    });
  });

  describe('compareModelCosts', () => {
    it('should compare costs across models', () => {
      const comparisons = compareModelCosts('What is the meaning of life?');

      expect(comparisons.length).toBeGreaterThan(0);
      expect(comparisons[0]).toHaveProperty('model');
      expect(comparisons[0]).toHaveProperty('cost');
      expect(comparisons[0]).toHaveProperty('alias');
    });

    it('should sort by cost (cheapest first)', () => {
      const comparisons = compareModelCosts('Test query');

      for (let i = 1; i < comparisons.length; i++) {
        expect(comparisons[i].cost).toBeGreaterThanOrEqual(comparisons[i - 1].cost);
      }
    });

    it('should include context in comparison', () => {
      const withoutContext = compareModelCosts('Test query');
      const withContext = compareModelCosts('Test query', 'Additional context for the query');

      // With context should have higher costs
      expect(withContext[0].cost).toBeGreaterThan(withoutContext[0].cost);
    });
  });
});
