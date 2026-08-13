import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { WatermarkForm } from './watermark-form';

export const metadata: Metadata = {
    title: 'Add a watermark to an image',
    description:
        'Stamp text or a logo onto JPEG, PNG, WEBP or AVIF images — nine positions, adjustable size, margin and opacity, up to 20 images at once.',
    alternates: { canonical: '/watermark' },
};

export default function WatermarkPage() {
    return (
        <ToolPage
            href="/watermark"
            title="Watermark"
            description="Stamp your name or your logo onto a batch of photos. The size follows each image's width, so the same settings look right on a thumbnail and on a full-resolution shot."
        >
            <WatermarkForm />
        </ToolPage>
    );
}
