import { afterEach, describe, expect, it, vi } from 'vitest';

import { Logger, type LogEntry } from './logger';

function spy(level: 'error' | 'warn' | 'info') {
    return vi.spyOn(console, level).mockImplementation(() => {});
}

function entryOf(call: unknown[]): LogEntry {
    return call[1] as LogEntry;
}

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe('Logger', () => {
    it('tags entries with the level, the side and the event', () => {
        const error = spy('error');

        Logger.error('action.failed', { tool: 'compress' });

        const [label, entry] = error.mock.calls[0];

        expect(label).toBe('[server] action.failed');
        expect(entry).toMatchObject({
            level: 'error',
            side: 'server',
            event: 'action.failed',
            tool: 'compress',
        });
        expect(Date.parse((entry as LogEntry).ts)).not.toBeNaN();
    });

    it('routes each level to its console method', () => {
        const error = spy('error');
        const warn = spy('warn');
        const info = spy('info');

        Logger.error('a');
        Logger.warn('b');
        Logger.info('c');

        expect(error).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(info).toHaveBeenCalledTimes(1);
        expect(entryOf(warn.mock.calls[0]).level).toBe('warn');
        expect(entryOf(info.mock.calls[0]).level).toBe('info');
    });

    it('writes one JSON line on the server in production', () => {
        vi.stubEnv('NODE_ENV', 'production');

        const error = spy('error');

        Logger.error('action.failed', { tool: 'resize' });

        const [line] = error.mock.calls[0];

        expect(typeof line).toBe('string');
        expect(error.mock.calls[0]).toHaveLength(1);
        expect(line as string).not.toContain('\n');
        expect(JSON.parse(line as string)).toMatchObject({
            level: 'error',
            side: 'server',
            event: 'action.failed',
            tool: 'resize',
        });
    });

    it('unpacks an error into name, message, code and stack', () => {
        const error = spy('error');
        const failure = Object.assign(new TypeError('boom'), { code: 'ENOENT' });

        Logger.error('image.failed', { error: failure });

        expect(entryOf(error.mock.calls[0]).error).toMatchObject({
            name: 'TypeError',
            message: 'boom',
            code: 'ENOENT',
        });
        expect(entryOf(error.mock.calls[0]).error?.stack).toContain('TypeError: boom');
    });

    it('truncates a runaway stack', () => {
        const error = spy('error');
        const failure = new Error('deep');

        failure.stack = 'x'.repeat(5000);

        Logger.error('image.failed', { error: failure });

        expect(entryOf(error.mock.calls[0]).error?.stack).toHaveLength(1501);
    });

    it('describes a thrown value that is not an Error', () => {
        const error = spy('error');

        Logger.error('image.failed', { error: 'just a string' });

        expect(entryOf(error.mock.calls[0]).error).toEqual({
            name: 'NonError',
            message: 'just a string',
        });
    });

    it('omits the error key when nothing was thrown', () => {
        const error = spy('error');

        Logger.error('action.failed');

        expect(entryOf(error.mock.calls[0])).not.toHaveProperty('error');
    });

    it('stamps scoped context on every entry, and lets the payload win', () => {
        const warn = spy('warn');
        const scoped = Logger.scope({ tool: 'convert', stage: 'read' });

        scoped.warn('action.rate_limited', { stage: 'process', cost: 4 });

        expect(entryOf(warn.mock.calls[0])).toMatchObject({
            tool: 'convert',
            stage: 'process',
            cost: 4,
        });
    });

    it('nests scopes', () => {
        const info = spy('info');

        Logger.scope({ tool: 'pdf' }).scope({ page: 2 }).info('pdf.page');

        expect(entryOf(info.mock.calls[0])).toMatchObject({ tool: 'pdf', page: 2 });
    });

    it('never throws on context it cannot serialize', () => {
        vi.stubEnv('NODE_ENV', 'production');

        const error = spy('error');
        const circular: Record<string, unknown> = {};

        circular.self = circular;

        expect(() => Logger.error('action.failed', { circular })).not.toThrow();
        expect(error.mock.calls[0][0]).toBe('[logger] could not write action.failed');
    });
});
