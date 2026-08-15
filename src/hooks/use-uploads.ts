'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type UploadsOptions<Item> = {
    max: number;
    onEvict?: (item: Item) => void;
};

export function useUploads<Item>({ max, onEvict }: UploadsOptions<Item>) {
    const [items, setItems] = useState<Item[]>([]);
    const currentRef = useRef<Item[]>([]);
    const evictRef = useRef(onEvict);

    useEffect(() => {
        evictRef.current = onEvict;
    });

    const commit = useCallback((next: Item[]) => {
        for (const item of currentRef.current) {
            if (!next.includes(item)) evictRef.current?.(item);
        }

        currentRef.current = next;
        setItems(next);
    }, []);

    const addItems = useCallback(
        (added: Item[]) =>
            commit(max === 1 ? added.slice(0, 1) : [...currentRef.current, ...added].slice(0, max)),
        [commit, max]
    );

    const removeItem = useCallback(
        (index: number) => commit(currentRef.current.filter((_, at) => at !== index)),
        [commit]
    );

    const moveItem = useCallback(
        (from: number, to: number) => {
            const next = [...currentRef.current];

            if (from < 0 || from >= next.length || to < 0 || to >= next.length) return;

            const [moved] = next.splice(from, 1);

            next.splice(to, 0, moved);
            commit(next);
        },
        [commit]
    );

    const clearItems = useCallback(() => commit([]), [commit]);

    useEffect(
        () => () => {
            for (const item of currentRef.current) evictRef.current?.(item);
        },
        []
    );

    return { items, addItems, removeItem, moveItem, clearItems };
}
