'use client';

import Image from 'next/image';

import type { LoadedImage } from '@/components/image-dropzone';
import {
    watermarkLogoLayout,
    watermarkOffset,
    watermarkTextLayout,
    type WatermarkPosition,
} from '@/lib/image';

const PREVIEW_MAX_WIDTH = 448;
const PREVIEW_MAX_HEIGHT = 260;

type WatermarkPreviewProps = {
    image: LoadedImage;
    logo: LoadedImage | null;
    text: string;
    color: string;
    position: WatermarkPosition;
    opacity: number;
    scale: number;
    margin: number;
};

export function WatermarkPreview({
    image,
    logo,
    text,
    color,
    position,
    opacity,
    scale,
    margin,
}: WatermarkPreviewProps) {
    const size = { width: image.width, height: image.height };
    const factor = Math.min(1, PREVIEW_MAX_WIDTH / image.width, PREVIEW_MAX_HEIGHT / image.height);
    const layout = logo
        ? { ...watermarkLogoLayout(size, scale, logo), fontSize: 0 }
        : watermarkTextLayout(size, scale, text);
    const offset = watermarkOffset(position, size, layout, margin);
    const fontSize = layout.fontSize * factor;

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
            <div
                className="absolute flex items-center justify-center overflow-hidden"
                style={{
                    left: offset.left * factor,
                    top: offset.top * factor,
                    width: layout.width * factor,
                    height: layout.height * factor,
                    opacity: opacity / 100,
                }}
            >
                {logo ? (
                    <Image
                        src={logo.previewUrl}
                        alt="Watermark"
                        fill
                        unoptimized
                        className="object-fill"
                    />
                ) : (
                    <span
                        className="leading-none font-semibold whitespace-pre"
                        style={{ color, fontSize, fontFamily: 'Helvetica, Arial, sans-serif' }}
                    >
                        {text}
                    </span>
                )}
            </div>
        </div>
    );
}
