import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './mocks/server.js';
// Start MSW server before all tests
beforeAll(() => {
    server.listen({ onUnhandledRequest: 'warn' });
});
// Reset handlers after each test
afterEach(() => {
    server.resetHandlers();
});
// Clean up after all tests
afterAll(() => {
    server.close();
});
//# sourceMappingURL=setup.js.map