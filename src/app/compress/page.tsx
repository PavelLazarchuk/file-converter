import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { CompressForm } from './compress-form';

export const metadata: Metadata = {
    title: 'Compress an image',
    description:
        'Reduce image file size with adjustable quality or a target size, one image or a batch of 20. Metadata is always stripped.',
    alternates: { canonical: '/compress' },
};

export default function CompressPage() {
    return (
        <ToolPage
            href="/compress"
            title="Compress"
            description="Reduce file size with adjustable quality, or aim for a target size like 500 KB. Drop in up to 20 images at once. EXIF, ICC and XMP metadata are always removed."
        >
            <CompressForm />
        </ToolPage>
    );
}
