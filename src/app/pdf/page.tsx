import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { PdfForm } from './pdf-form';

export const metadata: Metadata = {
    title: 'Image to PDF',
    description:
        'Turn a JPEG, PNG, WEBP, AVIF, GIF or SVG into a single-page PDF, sized to fit the image or a standard A4/Letter page.',
    alternates: { canonical: '/pdf' },
};

export default function PdfPage() {
    return (
        <ToolPage
            title="Image to PDF"
            description="Wrap an image in a single-page PDF, sized to fit the image or a standard page."
        >
            <PdfForm />
        </ToolPage>
    );
}
