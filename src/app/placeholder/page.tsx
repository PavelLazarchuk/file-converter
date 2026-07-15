import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { PlaceholderForm } from './placeholder-form';

export const metadata: Metadata = {
    title: 'Generate a placeholder image — Image Toolbox',
    description:
        'Generate solid-color placeholder images with custom dimensions, colors and text as JPEG, PNG, WEBP or AVIF.',
};

export default function PlaceholderPage() {
    return (
        <ToolPage
            title="Placeholder"
            description="Generate a placeholder image with custom dimensions, colors and text — no upload needed."
        >
            <PlaceholderForm />
        </ToolPage>
    );
}
