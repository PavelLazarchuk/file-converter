import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

const objectUrls = new Map<string, Blob | MediaSource>();
let nextObjectUrl = 0;

URL.createObjectURL = (object: Blob | MediaSource) => {
    const url = `blob:mock/${nextObjectUrl++}`;

    objectUrls.set(url, object);

    return url;
};

URL.revokeObjectURL = (url: string) => {
    objectUrls.delete(url);
};

Object.defineProperty(window.Image.prototype, 'src', {
    configurable: true,
    get(this: HTMLImageElement) {
        return this.getAttribute('src') ?? '';
    },
    set(this: HTMLImageElement, value: string) {
        this.setAttribute('src', value);
        Object.defineProperty(this, 'naturalWidth', { configurable: true, value: 800 });
        Object.defineProperty(this, 'naturalHeight', { configurable: true, value: 600 });
        queueMicrotask(() => this.dispatchEvent(new Event('load')));
    },
});

afterEach(() => {
    cleanup();
    objectUrls.clear();
    vi.restoreAllMocks();
});
