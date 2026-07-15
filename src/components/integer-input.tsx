'use client';

import { Input } from '@/components/ui/input';

const BLOCKED_KEYS = ['e', 'E', '+', '-', '.', ','];

type IntegerInputProps = Omit<React.ComponentProps<typeof Input>, 'type'>;

export function IntegerInput({ onKeyDown, onPaste, ...props }: IntegerInputProps) {
    return (
        <Input
            {...props}
            type="number"
            inputMode="numeric"
            step={1}
            onKeyDown={event => {
                if (BLOCKED_KEYS.includes(event.key)) event.preventDefault();

                onKeyDown?.(event);
            }}
            onPaste={event => {
                if (!/^\d+$/.test(event.clipboardData.getData('text').trim()))
                    event.preventDefault();

                onPaste?.(event);
            }}
        />
    );
}
