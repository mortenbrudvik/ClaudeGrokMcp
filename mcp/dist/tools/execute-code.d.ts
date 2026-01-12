/**
 * grok_execute_code Tool
 *
 * Execute Python code server-side via xAI's Agent Tools API.
 * Use cases: mathematical verification, algorithm testing, data analysis.
 */
import { XAIClient } from '../client/xai-client.js';
import { GrokExecuteCodeInput, Services } from '../types/index.js';
export declare const grokExecuteCodeSchema: {
    readonly $schema: "https://json-schema.org/draft/2020-12/schema";
    readonly type: "object";
    readonly properties: {
        readonly code: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 50000;
            readonly description: "Python code to execute";
        };
        readonly description: {
            readonly type: "string";
            readonly maxLength: 1000;
            readonly description: "What the code should accomplish (used as context)";
        };
        readonly include_output: {
            readonly type: "boolean";
            readonly default: true;
            readonly description: "Include raw stdout/stderr in response";
        };
        readonly max_turns: {
            readonly type: "integer";
            readonly minimum: 1;
            readonly maximum: 10;
            readonly default: 3;
            readonly description: "Maximum execution iterations";
        };
        readonly model: {
            readonly type: "string";
            readonly description: "Model to use (default: grok-4-1-fast)";
        };
    };
    readonly required: readonly ["code"];
    readonly additionalProperties: false;
};
export declare const grokExecuteCodeToolDefinition: {
    name: string;
    description: string;
    inputSchema: {
        readonly $schema: "https://json-schema.org/draft/2020-12/schema";
        readonly type: "object";
        readonly properties: {
            readonly code: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 50000;
                readonly description: "Python code to execute";
            };
            readonly description: {
                readonly type: "string";
                readonly maxLength: 1000;
                readonly description: "What the code should accomplish (used as context)";
            };
            readonly include_output: {
                readonly type: "boolean";
                readonly default: true;
                readonly description: "Include raw stdout/stderr in response";
            };
            readonly max_turns: {
                readonly type: "integer";
                readonly minimum: 1;
                readonly maximum: 10;
                readonly default: 3;
                readonly description: "Maximum execution iterations";
            };
            readonly model: {
                readonly type: "string";
                readonly description: "Model to use (default: grok-4-1-fast)";
            };
        };
        readonly required: readonly ["code"];
        readonly additionalProperties: false;
    };
};
/**
 * Validate and normalize input parameters
 */
export declare function validateGrokExecuteCodeInput(input: unknown): GrokExecuteCodeInput;
/**
 * Handle grok_execute_code tool execution
 */
export declare function handleGrokExecuteCode(client: XAIClient, args: unknown, services?: Services): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=execute-code.d.ts.map