'use client';

import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import type { LoadedImage } from '@/components/image-dropzone';
import {
    SVG_FONT_STACK,
    rotatedBounds,
    watermarkLogoLayout,
    watermarkOffset,
    watermarkTextLayout,
    watermarkTileStep,
    type WatermarkLayout,
    type WatermarkPosition,
} from '@/lib/image';

const PREVIEW_MAX_WIDTH = 448;
const PREVIEW_MAX_HEIGHT = 260;

type WatermarkPreviewProps = {
    image: LoadedImage;
    logo: LoadedImage | null;
    text: string;
    color: string;
    layout: WatermarkLayout;
    position: WatermarkPosition;
    opacity: number;
    scale: number;
    margin: number;
    angle: number;
};

export function WatermarkPreview({
    image,
    logo,
    text,
    color,
    layout,
    position,
    opacity,
    scale,
    margin,
    angle,
}: WatermarkPreviewProps) {
    const t = useTranslations('Watermark');
    const size = { width: image.width, height: image.height };
    const factor = Math.min(1, PREVIEW_MAX_WIDTH / image.width, PREVIEW_MAX_HEIGHT / image.height);
    const cell = logo
        ? { ...watermarkLogoLayout(size, scale, logo), fontSize: 0 }
        : watermarkTextLayout(size, scale, text);
    const bounds = rotatedBounds(cell, angle);
    const fontSize = cell.fontSize * factor;

    const mark = logo ? (
        <Image
            src={logo.previewUrl}
            alt={t('watermark')}
            fill
            unoptimized
            className="object-fill"
        />
    ) : (
        <span
            className="leading-none font-semibold whitespace-pre"
            style={{ color, fontSize, fontFamily: SVG_FONT_STACK }}
        >
            {text}
        </span>
    );

    function cellAt(key: string, style: CSSProperties): ReactNode {
        return (
            <div
                key={key}
                className="absolute flex items-center justify-center"
                style={{ opacity: opacity / 100, ...style }}
            >
                <div
                    className="relative"
                    style={{
                        width: cell.width * factor,
                        height: cell.height * factor,
                        transform: angle ? `rotate(${angle}deg)` : undefined,
                    }}
                >
                    {mark}
                </div>
            </div>
        );
    }

    let stamp: ReactNode;

    if (layout === 'tile') {
        const step = watermarkTileStep(cell, angle, margin);
        const cols = Math.ceil(size.width / step.width) + 1;
        const rows = Math.ceil(size.height / step.height) + 1;

        stamp = Array.from({ length: cols * rows }, (_, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);

            return cellAt(`${col}-${row}`, {
                left: col * step.width * factor,
                top: row * step.height * factor,
                width: step.width * factor,
                height: step.height * factor,
            });
        });
    } else {
        const offset = watermarkOffset(position, size, bounds, margin);

        stamp = cellAt('single', {
            left: offset.left * factor,
            top: offset.top * factor,
            width: bounds.width * factor,
            height: bounds.height * factor,
        });
    }

    return (
        <div
            className="relative overflow-hidden rounded-lg border bg-muted"
            style={{ width: image.width * factor, height: image.height * factor }}
        >
            <Image
                src={image.previewUrl}
                alt={image.file.name}
                fill
                unoptimized
                className="object-contain"
            />
            {stamp}
        </div>
    );
}
