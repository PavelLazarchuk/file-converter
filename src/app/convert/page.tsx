import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { ConvertForm } from './convert-form';

export const metadata: Metadata = {
    title: 'Convert an image',
    description:
        'Convert images in bulk between JPEG, PNG, WEBP, AVIF, GIF, TIFF and SVG, build an ICO favicon, or get a Base64 data URI.',
    alternates: { canonical: '/convert' },
};

export default function ConvertPage() {
    return (
        <ToolPage
            href="/convert"
            title="Convert"
            description="Change the format of one image or a batch of 20, or turn the file into a Base64 data URI. Available targets are based on the uploaded files' types."
        >
            <ConvertForm />
        </ToolPage>
    );
}
