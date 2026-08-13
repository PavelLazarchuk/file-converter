import { describe, expect, it, vi } from 'vitest';

import { Logger, type LogEntry } from './logger';

describe('Logger in the browser', () => {
    it('marks the side as client and records the page it happened on', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        window.history.replaceState(null, '', '/compress');

        Logger.error('action.transport_failed', { error: new Error('offline') });

        const [label, entry] = error.mock.calls[0];

        expect(label).toBe('[client] action.transport_failed');
        expect(entry).toMatchObject({ side: 'client', path: '/compress' });
        expect((entry as LogEntry).error).toMatchObject({ name: 'Error', message: 'offline' });
    });

    it('keeps the object form in production so devtools can expand it', () => {
        vi.stubEnv('NODE_ENV', 'production');

        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        Logger.error('render.crashed');

        expect(error.mock.calls[0]).toHaveLength(2);
        expect(error.mock.calls[0][1]).toMatchObject({ side: 'client' });

        vi.unstubAllEnvs();
    });
});
