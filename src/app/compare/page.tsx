import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { CompareForm } from './compare-form';

export const metadata: Metadata = {
    title: 'Compare image formats',
    description:
        'See what one image weighs as JPEG, PNG, WEBP and AVIF at the same quality, side by side, and download the smallest.',
    alternates: { canonical: '/compare' },
};

export default function ComparePage() {
    return (
        <ToolPage
            href="/compare"
            title="Compare formats"
            description="Encode one image to every format at the same quality and see which comes out smallest, before you commit to one."
        >
            <CompareForm />
        </ToolPage>
    );
}
