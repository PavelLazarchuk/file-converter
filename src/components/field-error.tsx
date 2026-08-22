'use client';

import type { FieldError as RhfFieldError } from 'react-hook-form';

import { useFieldMessage } from '@/hooks/use-messages';

export function FieldError({ error, id }: { error?: RhfFieldError; id?: string }) {
    const message = useFieldMessage();

    if (!error) return null;

    return (
        <p id={id} role="alert" className="text-sm text-destructive">
            {message(error.message)}
        </p>
    );
}
