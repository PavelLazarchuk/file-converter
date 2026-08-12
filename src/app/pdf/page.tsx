import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { PdfForm } from './pdf-form';

export const metadata: Metadata = {
    title: 'Images to PDF',
    description:
        'Turn JPEG, PNG, WEBP, AVIF, GIF or SVG images into a PDF — one page each, sized to fit the image or a standard A4/Letter page.',
    alternates: { canonical: '/pdf' },
};

export default function PdfPage() {
    return (
        <ToolPage
            href="/pdf"
            title="Images to PDF"
            description="Wrap one image in a PDF, or several into a multi-page one, sized to fit the image or a standard page."
        >
            <PdfForm />
        </ToolPage>
    );
}
