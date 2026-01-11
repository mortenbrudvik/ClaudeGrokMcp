/**
 * grok_analyze_code Tool Tests
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from '../test/mocks/server.js';
import { XAIClient } from '../client/xai-client.js';
import {
  executeAnalyzeCode,
  handleAnalyzeCode,
  detectLanguage,
  analyzeCodeSchema,
  AnalyzeCodeInput,
} from './analyze-code.js';

describe('grok_analyze_code tool', () => {
  let client: XAIClient;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    client = new XAIClient({ apiKey: 'xai-test-key-1234567890' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('detectLanguage', () => {
    it('should detect JavaScript', () => {
      const code = `const foo = () => { return 'bar'; }`;
      expect(detectLanguage(code)).toBe('javascript');
    });

    it('should detect TypeScript', () => {
      const code = `interface User { name: string; age: number; }`;
      expect(detectLanguage(code)).toBe('typescript');
    });

    it('should detect Python', () => {
      const code = `def hello(name):\n    print(f"Hello {name}")`;
      expect(detectLanguage(code)).toBe('python');
    });

    it('should detect Go', () => {
      const code = `func main() { fmt.Println("Hello") }`;
      expect(detectLanguage(code)).toBe('go');
    });

    it('should detect Rust', () => {
      const code = `fn main() { println!("Hello"); }`;
      expect(detectLanguage(code)).toBe('rust');
    });

    it('should detect Java', () => {
      const code = `public class Main { public static void main(String[] args) {} }`;
      expect(detectLanguage(code)).toBe('java');
    });

    it('should detect C#', () => {
      const code = `namespace MyApp { using System; }`;
      expect(detectLanguage(code)).toBe('csharp');
    });

    it('should detect SQL', () => {
      const code = `SELECT * FROM users WHERE id = 1`;
      expect(detectLanguage(code)).toBe('sql');
    });

    it('should return unknown for unrecognized code', () => {
      const code = `some random text`;
      expect(detectLanguage(code)).toBe('unknown');
    });
  });

  describe('analyzeCodeSchema', () => {
    it('should have required code property', () => {
      expect(analyzeCodeSchema.required).toContain('code');
    });

    it('should have valid analysis_type enum', () => {
      const enumValues = analyzeCodeSchema.properties.analysis_type.enum;
      expect(enumValues).toContain('performance');
      expect(enumValues).toContain('bugs');
      expect(enumValues).toContain('security');
      expect(enumValues).toContain('style');
      expect(enumValues).toContain('all');
    });

    it('should use JSON Schema 2020-12', () => {
      expect(analyzeCodeSchema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    });
  });

  describe('executeAnalyzeCode', () => {
    it('should analyze code and return issues', async () => {
      const input: AnalyzeCodeInput = {
        code: `function unsafe(input) { eval(input); }`,
        language: 'javascript',
        analysis_type: 'security',
      };

      const result = await executeAnalyzeCode(client, input);

      expect(result.language).toBe('javascript');
      expect(result.analysisType).toBe('security');
      expect(result.model).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.cost).toBeDefined();
      expect(result.response_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should auto-detect language when not provided', async () => {
      const input: AnalyzeCodeInput = {
        code: `def hello():\n    print("Hello")`,
      };

      const result = await executeAnalyzeCode(client, input);

      expect(result.language).toBe('python');
    });

    it('should default to all analysis type', async () => {
      const input: AnalyzeCodeInput = {
        code: `const x = 1;`,
        language: 'javascript',
      };

      const result = await executeAnalyzeCode(client, input);

      expect(result.analysisType).toBe('all');
    });

    it('should use default model when not specified', async () => {
      const input: AnalyzeCodeInput = {
        code: `const x = 1;`,
      };

      const result = await executeAnalyzeCode(client, input);

      // The mock returns the model, but we're checking the request was made
      expect(result.model).toBeDefined();
    });

    it('should include context in analysis', async () => {
      const input: AnalyzeCodeInput = {
        code: `const password = "secret123";`,
        language: 'javascript',
        analysis_type: 'security',
        context: 'This is a config file for a production service',
      };

      const result = await executeAnalyzeCode(client, input);

      // The analysis should complete with the context
      expect(result.summary).toBeDefined();
    });

    it('should throw error for empty code', async () => {
      const input: AnalyzeCodeInput = {
        code: '',
      };

      await expect(executeAnalyzeCode(client, input)).rejects.toThrow('Code is required');
    });

    it('should throw error for whitespace-only code', async () => {
      const input: AnalyzeCodeInput = {
        code: '   \n\t  ',
      };

      await expect(executeAnalyzeCode(client, input)).rejects.toThrow('Code is required');
    });

    it('should calculate cost correctly', async () => {
      const input: AnalyzeCodeInput = {
        code: `const x = 1;`,
        language: 'javascript',
      };

      const result = await executeAnalyzeCode(client, input);

      expect(result.cost.estimated_usd).toBeGreaterThanOrEqual(0);
      expect(result.cost.input_tokens).toBe(result.usage.prompt_tokens);
      expect(result.cost.output_tokens).toBe(result.usage.completion_tokens);
    });
  });

  describe('handleAnalyzeCode', () => {
    it('should return formatted MCP response on success', async () => {
      const input = {
        code: `function add(a, b) { return a + b; }`,
        language: 'javascript',
      };

      const result = await handleAnalyzeCode(client, input);

      expect(result.isError).toBe(false);
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('🤖 **Grok Code Analysis:**');
      expect(text).toContain('javascript');
    });

    it('should include summary in output', async () => {
      const input = {
        code: `const x = 1;`,
        language: 'javascript',
      };

      const result = await handleAnalyzeCode(client, input);

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Summary');
    });

    it('should include metadata in output', async () => {
      const input = {
        code: `const x = 1;`,
        language: 'javascript',
      };

      const result = await handleAnalyzeCode(client, input);

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('⚡');
      expect(text).toContain('tokens');
      expect(text).toContain('$');
      expect(text).toContain('ms');
    });

    it('should return error for invalid input', async () => {
      const result = await handleAnalyzeCode(client, null);

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Error');
    });

    it('should return error for missing code', async () => {
      const result = await handleAnalyzeCode(client, { language: 'javascript' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('code property is required');
    });

    it('should return error for non-string code', async () => {
      const result = await handleAnalyzeCode(client, { code: 123 });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('must be a string');
    });

    it('should accept all valid analysis types', async () => {
      const types = ['performance', 'bugs', 'security', 'style', 'all'];

      for (const type of types) {
        const input = {
          code: `const x = 1;`,
          analysis_type: type,
        };

        const result = await handleAnalyzeCode(client, input);
        expect(result.isError).toBe(false);
      }
    });
  });
});
