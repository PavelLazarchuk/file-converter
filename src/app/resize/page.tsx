import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { ResizeForm } from './resize-form';

export const metadata: Metadata = {
    title: 'Resize an image',
    description:
        'Resize JPEG, PNG, WEBP or AVIF images to exact pixel dimensions, one or twenty at a time, with optional rotation.',
    alternates: { canonical: '/resize' },
};

export default function ResizePage() {
    return (
        <ToolPage
            href="/resize"
            title="Resize"
            description="Set exact pixel dimensions and optionally rotate the image. Lock the aspect ratio to keep proportions intact; the same box applies to every image in a batch."
        >
            <ResizeForm />
        </ToolPage>
    );
}
