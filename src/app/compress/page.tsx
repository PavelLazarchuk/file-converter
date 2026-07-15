import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { CompressForm } from './compress-form';

export const metadata: Metadata = {
    title: 'Compress an image — Image Toolbox',
    description:
        'Reduce image file size with adjustable quality or a target size. Metadata is always stripped.',
};

export default function CompressPage() {
    return (
        <ToolPage
            title="Compress"
            description="Reduce file size with adjustable quality, or aim for a target size like 500 KB. EXIF, ICC and XMP metadata are always removed."
        >
            <CompressForm />
        </ToolPage>
    );
}
