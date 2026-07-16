import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { ConvertForm } from './convert-form';

export const metadata: Metadata = {
    title: 'Convert an image — Image Toolbox',
    description:
        'Convert images between JPEG, PNG, WEBP, AVIF, GIF, TIFF and SVG, build an ICO favicon, or get a Base64 data URI.',
};

export default function ConvertPage() {
    return (
        <ToolPage
            title="Convert"
            description="Change the image format, or turn the file into a Base64 data URI. Available targets are based on the uploaded file's type."
        >
            <ConvertForm />
        </ToolPage>
    );
}
