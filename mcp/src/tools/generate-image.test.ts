/**
 * grok_generate_image Tool Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateGrokGenerateImageInput,
  grokGenerateImageSchema,
  grokGenerateImageToolDefinition,
} from './generate-image.js';

describe('grok_generate_image tool', () => {
  describe('schema', () => {
    it('should have correct type', () => {
      expect(grokGenerateImageSchema.type).toBe('object');
    });

    it('should require prompt parameter', () => {
      expect(grokGenerateImageSchema.required).toContain('prompt');
    });

    it('should have n default to 1', () => {
      expect(grokGenerateImageSchema.properties.n.default).toBe(1);
    });

    it('should limit n to 1-10', () => {
      expect(grokGenerateImageSchema.properties.n.minimum).toBe(1);
      expect(grokGenerateImageSchema.properties.n.maximum).toBe(10);
    });

    it('should have response_format default to url', () => {
      expect(grokGenerateImageSchema.properties.response_format.default).toBe('url');
    });

    it('should limit response_format to url or b64_json', () => {
      expect(grokGenerateImageSchema.properties.response_format.enum).toEqual(['url', 'b64_json']);
    });

    it('should limit prompt length to 10000', () => {
      expect(grokGenerateImageSchema.properties.prompt.maxLength).toBe(10000);
    });

    it('should not allow additional properties', () => {
      expect(grokGenerateImageSchema.additionalProperties).toBe(false);
    });
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(grokGenerateImageToolDefinition.name).toBe('grok_generate_image');
    });

    it('should have description', () => {
      expect(grokGenerateImageToolDefinition.description).toContain('Generate images');
    });

    it('should mention JPEG format in description', () => {
      expect(grokGenerateImageToolDefinition.description).toContain('JPEG');
    });

    it('should include inputSchema', () => {
      expect(grokGenerateImageToolDefinition.inputSchema).toBe(grokGenerateImageSchema);
    });
  });

  describe('validateGrokGenerateImageInput', () => {
    it('should validate minimal input with just prompt', () => {
      const result = validateGrokGenerateImageInput({ prompt: 'A sunset' });
      expect(result.prompt).toBe('A sunset');
      expect(result.n).toBe(1);
      expect(result.response_format).toBe('url');
      expect(result.model).toBe('grok-2-image-1212');
    });

    it('should validate full input with all parameters', () => {
      const input = {
        prompt: 'A futuristic city',
        n: 3,
        response_format: 'b64_json',
        model: 'grok-2-image',
      };
      const result = validateGrokGenerateImageInput(input);
      expect(result.prompt).toBe('A futuristic city');
      expect(result.n).toBe(3);
      expect(result.response_format).toBe('b64_json');
      expect(result.model).toBe('grok-2-image');
    });

    it('should throw on missing prompt', () => {
      expect(() => validateGrokGenerateImageInput({})).toThrow('prompt parameter is required');
    });

    it('should throw on null prompt', () => {
      expect(() => validateGrokGenerateImageInput({ prompt: null })).toThrow(
        'prompt parameter is required'
      );
    });

    it('should throw on empty prompt', () => {
      expect(() => validateGrokGenerateImageInput({ prompt: '   ' })).toThrow(
        'prompt parameter cannot be empty'
      );
    });

    it('should throw on non-string prompt', () => {
      expect(() => validateGrokGenerateImageInput({ prompt: 123 })).toThrow(
        'prompt parameter must be a string'
      );
    });

    it('should throw on non-object input', () => {
      expect(() => validateGrokGenerateImageInput(null)).toThrow('Input must be an object');
      expect(() => validateGrokGenerateImageInput('string')).toThrow('Input must be an object');
      expect(() => validateGrokGenerateImageInput(undefined)).toThrow('Input must be an object');
    });

    it('should throw on n out of range (low)', () => {
      expect(() => validateGrokGenerateImageInput({ prompt: 'test', n: 0 })).toThrow(
        'n parameter must be between 1 and 10'
      );
    });

    it('should throw on n out of range (high)', () => {
      expect(() => validateGrokGenerateImageInput({ prompt: 'test', n: 11 })).toThrow(
        'n parameter must be between 1 and 10'
      );
    });

    it('should throw on non-integer n', () => {
      expect(() => validateGrokGenerateImageInput({ prompt: 'test', n: 2.5 })).toThrow(
        'n parameter must be an integer'
      );
    });

    it('should throw on non-number n', () => {
      expect(() => validateGrokGenerateImageInput({ prompt: 'test', n: 'three' })).toThrow(
        'n parameter must be an integer'
      );
    });

    it('should throw on invalid response_format', () => {
      expect(() =>
        validateGrokGenerateImageInput({ prompt: 'test', response_format: 'invalid' })
      ).toThrow('response_format must be "url" or "b64_json"');
    });

    it('should throw on non-string response_format', () => {
      expect(() =>
        validateGrokGenerateImageInput({ prompt: 'test', response_format: 123 })
      ).toThrow('response_format parameter must be a string');
    });

    it('should throw on non-string model', () => {
      expect(() => validateGrokGenerateImageInput({ prompt: 'test', model: 123 })).toThrow(
        'model parameter must be a string'
      );
    });

    it('should trim prompt whitespace', () => {
      const result = validateGrokGenerateImageInput({ prompt: '  A cat  ' });
      expect(result.prompt).toBe('A cat');
    });

    it('should accept prompt at maximum length', () => {
      const longPrompt = 'x'.repeat(10000);
      const result = validateGrokGenerateImageInput({ prompt: longPrompt });
      expect(result.prompt.length).toBe(10000);
    });

    it('should throw on prompt exceeding maximum length', () => {
      const tooLongPrompt = 'x'.repeat(10001);
      expect(() => validateGrokGenerateImageInput({ prompt: tooLongPrompt })).toThrow(
        'prompt parameter exceeds maximum length'
      );
    });

    it('should accept n at boundaries', () => {
      expect(validateGrokGenerateImageInput({ prompt: 'test', n: 1 }).n).toBe(1);
      expect(validateGrokGenerateImageInput({ prompt: 'test', n: 10 }).n).toBe(10);
    });

    it('should accept url response_format', () => {
      const result = validateGrokGenerateImageInput({ prompt: 'test', response_format: 'url' });
      expect(result.response_format).toBe('url');
    });

    it('should accept b64_json response_format', () => {
      const result = validateGrokGenerateImageInput({
        prompt: 'test',
        response_format: 'b64_json',
      });
      expect(result.response_format).toBe('b64_json');
    });
  });
});

describe('handleGrokGenerateImage', () => {
  // Mock client
  const mockClient = {
    generateImage: vi.fn(),
    calculateImageCost: vi.fn(),
    resolveModel: vi.fn((m: string) => m),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.calculateImageCost.mockReturnValue({
      estimated_usd: 0.003,
      input_tokens: 0,
      output_tokens: 300,
      model: 'grok-2-image-1212',
      pricing: { input_per_1m: 2.0, output_per_1m: 10.0 },
    });
    mockClient.generateImage.mockResolvedValue({
      created: Date.now(),
      data: [{ url: 'https://api.x.ai/images/test-image.jpg' }],
    });
  });

  it('should generate image with default settings', async () => {
    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat' });

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Image Generation Results');
    expect(mockClient.generateImage).toHaveBeenCalled();
  });

  it('should include URL in response', async () => {
    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat' });

    expect(result.content[0].text).toContain('View Image');
    expect(result.content[0].text).toContain('https://api.x.ai/images/test-image.jpg');
  });

  it('should include URL expiration notice for url format', async () => {
    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat' });

    expect(result.content[0].text).toContain('temporary');
  });

  it('should not include URL expiration notice for b64_json format', async () => {
    mockClient.generateImage.mockResolvedValue({
      created: Date.now(),
      data: [{ b64_json: 'SGVsbG8gV29ybGQ=' }], // base64 of "Hello World"
    });

    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, {
      prompt: 'A cat',
      response_format: 'b64_json',
    });

    expect(result.content[0].text).not.toContain('temporary');
    expect(result.content[0].text).toContain('base64');
  });

  it('should handle multiple images', async () => {
    mockClient.generateImage.mockResolvedValue({
      created: Date.now(),
      data: [
        { url: 'https://api.x.ai/images/image1.jpg' },
        { url: 'https://api.x.ai/images/image2.jpg' },
      ],
    });

    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat', n: 2 });

    expect(result.content[0].text).toContain('Generated 2 images');
    expect(result.content[0].text).toContain('Image 1');
    expect(result.content[0].text).toContain('Image 2');
  });

  it('should include revised prompt when returned by API', async () => {
    mockClient.generateImage.mockResolvedValue({
      created: Date.now(),
      data: [
        {
          url: 'https://api.x.ai/images/image.jpg',
          revised_prompt: 'A detailed image of a cat sitting on a windowsill',
        },
      ],
    });

    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat' });

    expect(result.content[0].text).toContain('Revised prompt');
    expect(result.content[0].text).toContain('A detailed image of a cat');
  });

  it('should include metadata in response', async () => {
    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat' });

    expect(result.content[0].text).toContain('grok-2-image-1212');
    expect(result.content[0].text).toContain('1 image');
    expect(result.content[0].text).toContain('$');
    expect(result.content[0].text).toMatch(/\d+ms/);
  });

  it('should handle errors gracefully', async () => {
    mockClient.generateImage.mockRejectedValue(new Error('API error'));

    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat' });

    expect(result.content[0].text).toContain('Image Generation Failed');
    expect(result.content[0].text).toContain('API error');
    expect(result.isError).toBe(true);
  });

  it('should use services when provided', async () => {
    const mockServices = {
      costTracker: {
        checkBudget: vi.fn(),
        addFromEstimate: vi.fn(),
      },
    };

    const { handleGrokGenerateImage } = await import('./generate-image.js');
    await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat' }, mockServices as any);

    expect(mockServices.costTracker.checkBudget).toHaveBeenCalled();
    expect(mockServices.costTracker.addFromEstimate).toHaveBeenCalled();
  });

  it('should call generateImage with correct parameters', async () => {
    const { handleGrokGenerateImage } = await import('./generate-image.js');
    await handleGrokGenerateImage(mockClient as any, {
      prompt: 'A cat',
      n: 3,
      response_format: 'b64_json',
      model: 'grok-2-image',
    });

    expect(mockClient.generateImage).toHaveBeenCalledWith({
      model: 'grok-2-image',
      prompt: 'A cat',
      n: 3,
      response_format: 'b64_json',
    });
  });

  it('should handle empty data array', async () => {
    mockClient.generateImage.mockResolvedValue({
      created: Date.now(),
      data: [],
    });

    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat' });

    expect(result.content[0].text).toContain('No images were generated');
  });

  it('should resolve model aliases', async () => {
    mockClient.resolveModel.mockReturnValue('grok-2-image-1212');

    const { handleGrokGenerateImage } = await import('./generate-image.js');
    await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat', model: 'image' });

    expect(mockClient.resolveModel).toHaveBeenCalledWith('image');
  });

  it('should set isError to false on success', async () => {
    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat' });

    expect(result.isError).toBe(false);
  });

  it('should calculate cost based on number of images', async () => {
    mockClient.generateImage.mockResolvedValue({
      created: Date.now(),
      data: [{ url: 'https://1.jpg' }, { url: 'https://2.jpg' }, { url: 'https://3.jpg' }],
    });

    const { handleGrokGenerateImage } = await import('./generate-image.js');
    await handleGrokGenerateImage(mockClient as any, { prompt: 'A cat', n: 3 });

    // Should call calculateImageCost twice: once for estimate, once for actual
    expect(mockClient.calculateImageCost).toHaveBeenCalledWith('grok-2-image-1212', 3); // estimate
    expect(mockClient.calculateImageCost).toHaveBeenCalledWith('grok-2-image-1212', 3); // actual
  });

  it('should format base64 response with size', async () => {
    const base64Data = 'a'.repeat(1024); // 1KB of base64 data
    mockClient.generateImage.mockResolvedValue({
      created: Date.now(),
      data: [{ b64_json: base64Data }],
    });

    const { handleGrokGenerateImage } = await import('./generate-image.js');
    const result = await handleGrokGenerateImage(mockClient as any, {
      prompt: 'A cat',
      response_format: 'b64_json',
    });

    expect(result.content[0].text).toContain('1KB');
  });
});
