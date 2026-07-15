import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { ResizeForm } from './resize-form';

export const metadata: Metadata = {
    title: 'Resize an image — Image Toolbox',
    description:
        'Resize JPEG, PNG, WEBP or AVIF images to exact pixel dimensions, with optional rotation.',
};

export default function ResizePage() {
    return (
        <ToolPage
            title="Resize"
            description="Set exact pixel dimensions and optionally rotate the image. Lock the aspect ratio to keep proportions intact."
        >
            <ResizeForm />
        </ToolPage>
    );
}
