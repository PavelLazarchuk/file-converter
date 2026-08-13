import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { MetadataForm } from './metadata-form';

export const metadata: Metadata = {
    title: 'View and remove image metadata (EXIF)',
    description:
        'Read the EXIF, camera, GPS location, color profile and dimensions stored inside JPEG, PNG, WEBP and AVIF images — then download a clean copy with all of it removed.',
    alternates: { canonical: '/metadata' },
};

export default function MetadataPage() {
    return (
        <ToolPage
            href="/metadata"
            title="Metadata"
            description="Photos carry more than pixels: the camera that took them, when, and often exactly where. Read what is inside yours, then get a copy with none of it."
        >
            <MetadataForm />
        </ToolPage>
    );
}
