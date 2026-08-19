'use client';

import type { FieldError as RhfFieldError } from 'react-hook-form';

import { useFieldMessage } from '@/hooks/use-messages';

export function FieldError({ error }: { error?: RhfFieldError }) {
    const message = useFieldMessage();

    if (!error) return null;

    return <p className="text-sm text-destructive">{message(error.message)}</p>;
}
