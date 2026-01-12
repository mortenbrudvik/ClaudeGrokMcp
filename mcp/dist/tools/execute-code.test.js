/**
 * grok_execute_code Tool Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateGrokExecuteCodeInput, grokExecuteCodeSchema, grokExecuteCodeToolDefinition, } from './execute-code.js';
describe('grok_execute_code tool', () => {
    describe('schema', () => {
        it('should have correct type', () => {
            expect(grokExecuteCodeSchema.type).toBe('object');
        });
        it('should require code parameter', () => {
            expect(grokExecuteCodeSchema.required).toContain('code');
        });
        it('should have include_output default to true', () => {
            expect(grokExecuteCodeSchema.properties.include_output.default).toBe(true);
        });
        it('should have max_turns default to 3', () => {
            expect(grokExecuteCodeSchema.properties.max_turns.default).toBe(3);
        });
        it('should limit max_turns to 1-10', () => {
            expect(grokExecuteCodeSchema.properties.max_turns.minimum).toBe(1);
            expect(grokExecuteCodeSchema.properties.max_turns.maximum).toBe(10);
        });
        it('should limit code length to 50000', () => {
            expect(grokExecuteCodeSchema.properties.code.maxLength).toBe(50000);
        });
    });
    describe('tool definition', () => {
        it('should have correct name', () => {
            expect(grokExecuteCodeToolDefinition.name).toBe('grok_execute_code');
        });
        it('should have description', () => {
            expect(grokExecuteCodeToolDefinition.description).toContain('Execute Python code');
        });
    });
    describe('validateGrokExecuteCodeInput', () => {
        it('should validate minimal input with just code', () => {
            const result = validateGrokExecuteCodeInput({ code: 'print("hello")' });
            expect(result.code).toBe('print("hello")');
            expect(result.include_output).toBe(true);
            expect(result.max_turns).toBe(3);
            expect(result.model).toBe('grok-4-1-fast');
        });
        it('should validate full input with all parameters', () => {
            const input = {
                code: 'print("hello")',
                description: 'Print a greeting',
                include_output: false,
                max_turns: 5,
                model: 'grok-4',
            };
            const result = validateGrokExecuteCodeInput(input);
            expect(result.code).toBe('print("hello")');
            expect(result.description).toBe('Print a greeting');
            expect(result.include_output).toBe(false);
            expect(result.max_turns).toBe(5);
            expect(result.model).toBe('grok-4');
        });
        it('should throw on missing code', () => {
            expect(() => validateGrokExecuteCodeInput({})).toThrow('code parameter is required');
        });
        it('should throw on empty code', () => {
            expect(() => validateGrokExecuteCodeInput({ code: '' })).toThrow('code parameter cannot be empty');
        });
        it('should throw on non-string code', () => {
            expect(() => validateGrokExecuteCodeInput({ code: 123 })).toThrow('code parameter must be a string');
        });
        it('should throw on non-object input', () => {
            expect(() => validateGrokExecuteCodeInput(null)).toThrow('Input must be an object');
            expect(() => validateGrokExecuteCodeInput('string')).toThrow('Input must be an object');
            expect(() => validateGrokExecuteCodeInput(undefined)).toThrow('Input must be an object');
        });
        it('should throw on invalid description type', () => {
            expect(() => validateGrokExecuteCodeInput({ code: 'x', description: 123 })).toThrow('description parameter must be a string');
        });
        it('should throw on invalid include_output type', () => {
            expect(() => validateGrokExecuteCodeInput({ code: 'x', include_output: 'yes' })).toThrow('include_output parameter must be a boolean');
        });
        it('should throw on invalid max_turns type', () => {
            expect(() => validateGrokExecuteCodeInput({ code: 'x', max_turns: 'five' })).toThrow('max_turns parameter must be an integer');
        });
        it('should throw on max_turns out of range (low)', () => {
            expect(() => validateGrokExecuteCodeInput({ code: 'x', max_turns: 0 })).toThrow('max_turns parameter must be between 1 and 10');
        });
        it('should throw on max_turns out of range (high)', () => {
            expect(() => validateGrokExecuteCodeInput({ code: 'x', max_turns: 11 })).toThrow('max_turns parameter must be between 1 and 10');
        });
        it('should throw on invalid model type', () => {
            expect(() => validateGrokExecuteCodeInput({ code: 'x', model: 123 })).toThrow('model parameter must be a string');
        });
        it('should accept code at maximum length', () => {
            const longCode = 'x'.repeat(50000);
            const result = validateGrokExecuteCodeInput({ code: longCode });
            expect(result.code.length).toBe(50000);
        });
        it('should throw on code exceeding maximum length', () => {
            const tooLongCode = 'x'.repeat(50001);
            expect(() => validateGrokExecuteCodeInput({ code: tooLongCode })).toThrow('code parameter exceeds maximum length');
        });
    });
});
describe('handleGrokExecuteCode', () => {
    // Mock client
    const mockClient = {
        responsesCreate: vi.fn(),
        calculateCost: vi.fn(),
        resolveModel: vi.fn((m) => m),
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
            content: 'The code executed successfully and printed "hello".\n\nOutput:\n```\nhello\n```',
            model: 'grok-4-1-fast',
            usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
            server_side_tool_usage: { SERVER_SIDE_TOOL_CODE_EXECUTION: 1 },
        });
    });
    it('should execute code with default settings', async () => {
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        const result = await handleGrokExecuteCode(mockClient, { code: 'print("hello")' });
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('Code Execution Results');
        expect(mockClient.responsesCreate).toHaveBeenCalled();
    });
    it('should include code_interpreter tool in request', async () => {
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        await handleGrokExecuteCode(mockClient, { code: 'print("hello")' });
        const call = mockClient.responsesCreate.mock.calls[0][0];
        expect(call.tools).toContainEqual({ type: 'code_interpreter' });
    });
    it('should include description in user message when provided', async () => {
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        await handleGrokExecuteCode(mockClient, {
            code: 'print("hello")',
            description: 'Print a greeting',
        });
        const call = mockClient.responsesCreate.mock.calls[0][0];
        const userMessage = call.input.find((m) => m.role === 'user');
        expect(userMessage.content).toContain('Task: Print a greeting');
    });
    it('should include metadata in response', async () => {
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        const result = await handleGrokExecuteCode(mockClient, { code: 'print("hello")' });
        expect(result.content[0].text).toContain('grok-4-1-fast');
        expect(result.content[0].text).toContain('300 tokens');
        expect(result.content[0].text).toContain('$');
    });
    it('should handle errors gracefully', async () => {
        mockClient.responsesCreate.mockRejectedValue(new Error('API error'));
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        const result = await handleGrokExecuteCode(mockClient, { code: 'print("hello")' });
        expect(result.content[0].text).toContain('Code Execution Failed');
        expect(result.content[0].text).toContain('API error');
    });
    it('should detect error responses', async () => {
        mockClient.responsesCreate.mockResolvedValue({
            id: 'resp-123',
            content: 'Error: ZeroDivisionError: division by zero\n\nThe code failed because...',
            model: 'grok-4-1-fast',
            usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
            server_side_tool_usage: {},
        });
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        const result = await handleGrokExecuteCode(mockClient, { code: '1/0' });
        expect(result.content[0].text).toContain('Execution encountered errors');
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
                release: vi.fn(),
            },
        };
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        await handleGrokExecuteCode(mockClient, { code: 'print("hello")' }, mockServices);
        expect(mockServices.costTracker.checkBudget).toHaveBeenCalled();
        expect(mockServices.rateLimiter.acquire).toHaveBeenCalled();
        expect(mockServices.costTracker.addFromEstimate).toHaveBeenCalled();
        expect(mockServices.rateLimiter.recordUsage).toHaveBeenCalled();
    });
    it('should release rate limit slot on error', async () => {
        mockClient.responsesCreate.mockRejectedValue(new Error('API error'));
        const mockServices = {
            costTracker: { checkBudget: vi.fn() },
            rateLimiter: {
                acquire: vi.fn().mockResolvedValue(undefined),
                release: vi.fn(),
            },
        };
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        await handleGrokExecuteCode(mockClient, { code: 'print("hello")' }, mockServices);
        expect(mockServices.rateLimiter.release).toHaveBeenCalled();
    });
    it('should respect max_turns parameter', async () => {
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        await handleGrokExecuteCode(mockClient, { code: 'print("hello")', max_turns: 5 });
        const call = mockClient.responsesCreate.mock.calls[0][0];
        expect(call.max_turns).toBe(5);
    });
    it('should request code_interpreter_call.outputs in include', async () => {
        const { handleGrokExecuteCode } = await import('./execute-code.js');
        await handleGrokExecuteCode(mockClient, { code: 'print("hello")' });
        const call = mockClient.responsesCreate.mock.calls[0][0];
        expect(call.include).toContain('code_interpreter_call.outputs');
    });
});
//# sourceMappingURL=execute-code.test.js.map