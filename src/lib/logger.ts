export type LogLevel = 'error' | 'warn' | 'info';
export type LogSide = 'server' | 'client';

export type LogContext = Record<string, unknown>;
export type LogPayload = LogContext & { error?: unknown };

export type LoggedError = {
    name: string;
    message: string;
    code?: string;
    stack?: string;
};

export type LogEntry = LogContext & {
    ts: string;
    level: LogLevel;
    side: LogSide;
    event: string;
    error?: LoggedError;
};

const MAX_STACK_CHARS = 1500;

const SIDE: LogSide = typeof window === 'undefined' ? 'server' : 'client';

function text(value: unknown): string {
    try {
        return String(value);
    } catch {
        return 'unserializable value';
    }
}

function describeError(value: unknown): LoggedError {
    if (!(value instanceof Error)) return { name: 'NonError', message: text(value) };

    const { code } = value as Error & { code?: unknown };
    const stack = value.stack ?? '';

    return {
        name: value.name,
        message: value.message,
        ...(typeof code === 'string' ? { code } : {}),
        ...(stack
            ? {
                  stack:
                      stack.length > MAX_STACK_CHARS
                          ? `${stack.slice(0, MAX_STACK_CHARS)}…`
                          : stack,
              }
            : {}),
    };
}

function emit(level: LogLevel, entry: LogEntry): void {
    if (SIDE === 'server' && process.env.NODE_ENV === 'production') {
        console[level](JSON.stringify(entry));

        return;
    }

    console[level](`[${entry.side}] ${entry.event}`, entry);
}

export class Logger {
    private static readonly root = new Logger();

    private constructor(private readonly context: LogContext = {}) {}

    static scope(context: LogContext): Logger {
        return new Logger(context);
    }

    static error(event: string, payload?: LogPayload): void {
        Logger.root.error(event, payload);
    }

    static warn(event: string, payload?: LogPayload): void {
        Logger.root.warn(event, payload);
    }

    static info(event: string, payload?: LogPayload): void {
        Logger.root.info(event, payload);
    }

    scope(context: LogContext): Logger {
        return new Logger({ ...this.context, ...context });
    }

    error(event: string, payload?: LogPayload): void {
        this.write('error', event, payload);
    }

    warn(event: string, payload?: LogPayload): void {
        this.write('warn', event, payload);
    }

    info(event: string, payload?: LogPayload): void {
        this.write('info', event, payload);
    }

    private write(level: LogLevel, event: string, payload: LogPayload = {}): void {
        try {
            const { error, ...rest } = payload;

            emit(level, {
                ts: new Date().toISOString(),
                level,
                side: SIDE,
                event,
                ...(SIDE === 'client' ? { path: window.location.pathname } : {}),
                ...this.context,
                ...rest,
                ...(error === undefined ? {} : { error: describeError(error) }),
            });
        } catch (failure) {
            console.error(`[logger] could not write ${event}`, failure);
        }
    }
}
