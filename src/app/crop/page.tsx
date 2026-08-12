import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { CropForm } from './crop-form';

export const metadata: Metadata = {
    title: 'Crop an image',
    description:
        'Crop JPEG, PNG, WEBP or AVIF images to a preset aspect ratio like 1:1 or 16:9, or a circle with transparent corners, using a draggable crop area.',
    alternates: { canonical: '/crop' },
};

export default function CropPage() {
    return (
        <ToolPage
            href="/crop"
            title="Crop"
            description="Pick a preset aspect ratio, then drag the frame to choose exactly what to keep."
        >
            <CropForm />
        </ToolPage>
    );
}
