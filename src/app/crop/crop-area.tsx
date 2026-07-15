'use client';

import { useRef } from 'react';
import Image from 'next/image';

import type { LoadedImage } from '@/components/image-dropzone';
import { clampCropBox, type CropBox } from '@/lib/image';
import { cn } from '@/lib/utils';

type Corner = 'nw' | 'ne' | 'sw' | 'se';
type DragMode = 'move' | Corner;

type DragState = {
    mode: DragMode;
    pointerId: number;
    startX: number;
    startY: number;
    startBox: CropBox;
};

const CORNERS: Record<Corner, { className: string; x: -1 | 1; y: -1 | 1 }> = {
    nw: { className: '-top-1.5 -left-1.5 cursor-nwse-resize', x: -1, y: -1 },
    ne: { className: '-top-1.5 -right-1.5 cursor-nesw-resize', x: 1, y: -1 },
    sw: { className: '-bottom-1.5 -left-1.5 cursor-nesw-resize', x: -1, y: 1 },
    se: { className: '-bottom-1.5 -right-1.5 cursor-nwse-resize', x: 1, y: 1 },
};

const MIN_CROP_PX = 16;

type CropAreaProps = {
    image: LoadedImage;
    ratio: { width: number; height: number };
    box: CropBox;
    onChange: (box: CropBox) => void;
    disabled?: boolean;
};

export function CropArea({ image, ratio, box, onChange, disabled }: CropAreaProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<DragState | null>(null);

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

        onChange(
            drag.mode === 'move'
                ? moveBox(drag.startBox, dx, dy)
                : resizeBox(drag.startBox, drag.mode, dx, dy)
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

    function resizeBox(start: CropBox, corner: Corner, dx: number, dy: number): CropBox {
        const { x, y } = CORNERS[corner];
        const growX = x * dx;
        const growY = (y * dy * ratio.width) / ratio.height;
        const grow = Math.abs(growX) >= Math.abs(growY) ? growX : growY;
        const right = start.left + start.width;
        const bottom = start.top + start.height;
        const maxWidth = Math.min(
            x < 0 ? right : image.width - start.left,
            ((y < 0 ? bottom : image.height - start.top) * ratio.width) / ratio.height
        );
        const minWidth = Math.min(maxWidth, Math.max(MIN_CROP_PX, ratio.width / ratio.height));
        const width = Math.min(maxWidth, Math.max(minWidth, start.width + grow));
        const height = (width * ratio.height) / ratio.width;

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

    const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

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
                role="presentation"
                className={cn(
                    'absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]',
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
                <div aria-hidden className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                    <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                    <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                    <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
                </div>
                {!disabled &&
                    (Object.keys(CORNERS) as Corner[]).map(corner => (
                        <div
                            key={corner}
                            role="presentation"
                            className={cn(
                                'absolute size-3 rounded-full border border-primary bg-white shadow-sm',
                                CORNERS[corner].className
                            )}
                            data-drag-mode={corner}
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
