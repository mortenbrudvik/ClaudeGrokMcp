/**
 * grok_search_x Tool
 */
import { XAIClient } from '../client/xai-client.js';
import { GrokSearchXInput, Services } from '../types/index.js';
export declare const grokSearchXSchema: {
    readonly $schema: "https://json-schema.org/draft/2020-12/schema";
    readonly type: "object";
    readonly properties: {
        readonly query: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 10000;
        };
        readonly enable_web_search: {
            readonly type: "boolean";
            readonly default: false;
        };
        readonly enable_x_search: {
            readonly type: "boolean";
            readonly default: true;
        };
        readonly max_turns: {
            readonly type: "integer";
            readonly minimum: 1;
            readonly maximum: 20;
            readonly default: 3;
        };
        readonly x_handles: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly exclude_x_handles: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly from_date: {
            readonly type: "string";
        };
        readonly to_date: {
            readonly type: "string";
        };
        readonly domains: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly exclude_domains: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
        readonly include_citations: {
            readonly type: "boolean";
            readonly default: true;
        };
    };
    readonly required: readonly ["query"];
    readonly additionalProperties: false;
};
export declare const grokSearchXToolDefinition: {
    name: string;
    description: string;
    inputSchema: {
        readonly $schema: "https://json-schema.org/draft/2020-12/schema";
        readonly type: "object";
        readonly properties: {
            readonly query: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 10000;
            };
            readonly enable_web_search: {
                readonly type: "boolean";
                readonly default: false;
            };
            readonly enable_x_search: {
                readonly type: "boolean";
                readonly default: true;
            };
            readonly max_turns: {
                readonly type: "integer";
                readonly minimum: 1;
                readonly maximum: 20;
                readonly default: 3;
            };
            readonly x_handles: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
            };
            readonly exclude_x_handles: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
            };
            readonly from_date: {
                readonly type: "string";
            };
            readonly to_date: {
                readonly type: "string";
            };
            readonly domains: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
            };
            readonly exclude_domains: {
                readonly type: "array";
                readonly items: {
                    readonly type: "string";
                };
            };
            readonly include_citations: {
                readonly type: "boolean";
                readonly default: true;
            };
        };
        readonly required: readonly ["query"];
        readonly additionalProperties: false;
    };
};
export declare function validateGrokSearchXInput(input: unknown): GrokSearchXInput;
export declare function handleGrokSearchX(client: XAIClient, args: unknown, services?: Services): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=search-x.d.ts.map