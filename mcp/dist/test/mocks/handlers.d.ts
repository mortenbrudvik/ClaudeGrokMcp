export declare const handlers: import("msw").HttpHandler[];
export declare const errorHandlers: {
    unauthorized: import("msw").HttpHandler;
    rateLimited: import("msw").HttpHandler;
    serverError: import("msw").HttpHandler;
    modelNotFound: import("msw").HttpHandler;
};
export declare const mockData: {
    modelsResponse: {
        object: string;
        data: {
            id: string;
            object: string;
            created: number;
            owned_by: string;
        }[];
    };
    chatResponse: {
        id: string;
        object: string;
        created: number;
        model: string;
        choices: {
            index: number;
            message: {
                role: string;
                content: string;
            };
            finish_reason: string;
        }[];
        usage: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
        };
    };
};
//# sourceMappingURL=handlers.d.ts.map