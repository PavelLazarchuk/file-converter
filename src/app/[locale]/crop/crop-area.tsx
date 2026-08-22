'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import type { LoadedImage } from '@/components/image-dropzone';
import { clampCropBox, type CropBox, type CropShape } from '@/lib/image';
import { cn } from '@/lib/utils';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type DragMode = 'move' | Handle;

type DragState = {
    mode: DragMode;
    pointerId: number;
    startX: number;
    startY: number;
    startBox: CropBox;
};

type Axis = -1 | 0 | 1;

const HANDLES: Record<Handle, { className: string; x: Axis; y: Axis }> = {
    nw: { className: '-top-1.5 -left-1.5 cursor-nwse-resize', x: -1, y: -1 },
    n: { className: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize', x: 0, y: -1 },
    ne: { className: '-top-1.5 -right-1.5 cursor-nesw-resize', x: 1, y: -1 },
    e: { className: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize', x: 1, y: 0 },
    se: { className: '-bottom-1.5 -right-1.5 cursor-nwse-resize', x: 1, y: 1 },
    s: { className: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize', x: 0, y: 1 },
    sw: { className: '-bottom-1.5 -left-1.5 cursor-nesw-resize', x: -1, y: 1 },
    w: { className: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize', x: -1, y: 0 },
};

const CORNER_HANDLES: Handle[] = ['nw', 'ne', 'sw', 'se'];
const ALL_HANDLES = Object.keys(HANDLES) as Handle[];

const MIN_CROP_PX = 16;

const KEY_STEP = 1;
const KEY_STEP_FAST = 10;

const ARROWS: Record<string, { x: number; y: number }> = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
};

type CropAreaProps = {
    image: LoadedImage;
    ratio: { width: number; height: number } | null;
    box: CropBox;
    shape: CropShape;
    onChange: (box: CropBox) => void;
    disabled?: boolean;
};

export function CropArea({ image, ratio, box, shape, onChange, disabled }: CropAreaProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<DragState | null>(null);
    const t = useTranslations('Crop');

    function startDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (disabled) return;

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            mode: event.currentTarget.dataset.dragMode as DragMode,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startBox: box,
        };
    }

    function handleDrag(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        const rect = containerRef.current?.getBoundingClientRect();

        if (!drag || drag.pointerId !== event.pointerId || !rect?.width || !rect.height) return;

        const dx = ((event.clientX - drag.startX) * image.width) / rect.width;
        const dy = ((event.clientY - drag.startY) * image.height) / rect.height;

        if (drag.mode === 'move') {
            onChange(moveBox(drag.startBox, dx, dy));

            return;
        }

        onChange(
            ratio
                ? resizeLockedBox(drag.startBox, drag.mode, dx, dy, ratio)
                : resizeFreeBox(drag.startBox, drag.mode, dx, dy)
        );
    }

    function endDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    }

    function moveBox(start: CropBox, dx: number, dy: number): CropBox {
        return clampCropBox(
            { ...start, left: start.left + dx, top: start.top + dy },
            image.width,
            image.height
        );
    }

    function resizeLockedBox(
        start: CropBox,
        handle: Handle,
        dx: number,
        dy: number,
        lock: { width: number; height: number }
    ): CropBox {
        const { x, y } = HANDLES[handle];
        const growX = x * dx;
        const growY = (y * dy * lock.width) / lock.height;
        const grow = Math.abs(growX) >= Math.abs(growY) ? growX : growY;
        const right = start.left + start.width;
        const bottom = start.top + start.height;
        const maxWidth = Math.min(
            x < 0 ? right : image.width - start.left,
            ((y < 0 ? bottom : image.height - start.top) * lock.width) / lock.height
        );
        const minWidth = Math.min(maxWidth, Math.max(MIN_CROP_PX, lock.width / lock.height));
        const width = Math.min(maxWidth, Math.max(minWidth, start.width + grow));
        const height = (width * lock.height) / lock.width;

        return clampCropBox(
            {
                left: x < 0 ? right - width : start.left,
                top: y < 0 ? bottom - height : start.top,
                width,
                height,
            },
            image.width,
            image.height
        );
    }

    function resizeFreeBox(start: CropBox, handle: Handle, dx: number, dy: number): CropBox {
        const { x, y } = HANDLES[handle];
        const right = start.left + start.width;
        const bottom = start.top + start.height;
        const next = { ...start };

        if (x !== 0) {
            next.width =
                x < 0
                    ? Math.min(right, Math.max(MIN_CROP_PX, start.width - dx))
                    : Math.min(image.width - start.left, Math.max(MIN_CROP_PX, start.width + dx));
            next.left = x < 0 ? right - next.width : start.left;
        }

        if (y !== 0) {
            next.height =
                y < 0
                    ? Math.min(bottom, Math.max(MIN_CROP_PX, start.height - dy))
                    : Math.min(image.height - start.top, Math.max(MIN_CROP_PX, start.height + dy));
            next.top = y < 0 ? bottom - next.height : start.top;
        }

        return clampCropBox(next, image.width, image.height);
    }

    function nudge(event: React.KeyboardEvent<HTMLDivElement>) {
        const arrow = ARROWS[event.key];

        if (disabled || !arrow) return;

        event.preventDefault();

        const step = event.shiftKey ? KEY_STEP_FAST : KEY_STEP;
        const dx = arrow.x * step;
        const dy = arrow.y * step;

        if (!event.altKey) {
            onChange(moveBox(box, dx, dy));

            return;
        }

        onChange(
            ratio ? resizeLockedBox(box, 'se', dx, dy, ratio) : resizeFreeBox(box, 'se', dx, dy)
        );
    }

    const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;
    const handles = ratio ? CORNER_HANDLES : ALL_HANDLES;

    return (
        <div
            ref={containerRef}
            className="relative mx-auto w-fit max-w-full touch-none overflow-hidden rounded-lg border bg-muted select-none"
        >
            <Image
                src={image.previewUrl}
                alt={image.file.name}
                width={image.width}
                height={image.height}
                unoptimized
                draggable={false}
                className="block h-auto max-h-96 w-auto max-w-full"
            />
            <div
                role="group"
                tabIndex={disabled ? -1 : 0}
                aria-label={t('frameLabel', {
                    width: Math.round(box.width),
                    height: Math.round(box.height),
                    left: Math.round(box.left),
                    top: Math.round(box.top),
                })}
                onKeyDown={nudge}
                className={cn(
                    'absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    shape === 'circle' && 'rounded-full',
                    !disabled && 'cursor-move'
                )}
                style={{
                    left: toPercent(box.left, image.width),
                    top: toPercent(box.top, image.height),
                    width: toPercent(box.width, image.width),
                    height: toPercent(box.height, image.height),
                }}
                data-drag-mode="move"
                onPointerDown={startDrag}
                onPointerMove={handleDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                {shape === 'rectangle' && (
                    <div aria-hidden className="pointer-events-none absolute inset-0">
                        <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                        <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                        <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                        <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
                    </div>
                )}
                {!disabled &&
                    handles.map(handle => (
                        <div
                            key={handle}
                            role="presentation"
                            className={cn(
                                'absolute size-3 rounded-full border border-primary bg-white shadow-sm',
                                HANDLES[handle].className
                            )}
                            data-drag-mode={handle}
                            onPointerDown={startDrag}
                            onPointerMove={handleDrag}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                        />
                    ))}
            </div>
        </div>
    );
}
