import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { MergePdfForm } from './merge-pdf-form';

export const metadata: Metadata = {
    title: 'Merge PDFs',
    description:
        'Combine several PDF files into one document, in the order you choose — the pages are copied across without their original titles or authors.',
    alternates: { canonical: '/merge-pdf' },
};

export default function MergePdfPage() {
    return (
        <ToolPage
            href="/merge-pdf"
            title="Merge PDFs"
            description="Combine several PDFs into one document, in whatever order you arrange them."
        >
            <MergePdfForm />
        </ToolPage>
    );
}
