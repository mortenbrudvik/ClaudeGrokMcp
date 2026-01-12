/**
 * Test fixtures for xAI API responses
 */
export declare const validChatResponse: {
    id: string;
    object: "chat.completion";
    created: number;
    model: string;
    choices: {
        index: number;
        message: {
            role: "assistant";
            content: string;
        };
        finish_reason: "stop";
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
};
export declare const modelsListResponse: {
    object: "list";
    data: {
        id: string;
        object: "model";
        created: number;
        owned_by: string;
    }[];
};
export declare const errorResponses: {
    unauthorized: {
        error: {
            message: string;
            type: string;
        };
    };
    rateLimited: {
        error: {
            message: string;
            type: string;
        };
    };
    serverError: {
        error: {
            message: string;
            type: string;
        };
    };
    modelNotFound: {
        error: {
            message: string;
            type: string;
        };
    };
};
/**
 * Model pricing data for cost calculation tests
 */
export declare const modelPricing: {
    'grok-4': {
        input_per_1m: number;
        output_per_1m: number;
    };
    'grok-4-fast': {
        input_per_1m: number;
        output_per_1m: number;
    };
    'grok-code-fast-1': {
        input_per_1m: number;
        output_per_1m: number;
    };
    'grok-4.1-fast': {
        input_per_1m: number;
        output_per_1m: number;
    };
};
//# sourceMappingURL=api-responses.d.ts.map