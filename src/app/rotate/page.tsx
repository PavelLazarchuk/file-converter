import type { Metadata } from 'next';

import { ToolPage } from '@/components/tool-page';
import { RotateForm } from './rotate-form';

export const metadata: Metadata = {
    title: 'Rotate & flip an image',
    description:
        'Rotate JPEG, PNG, WEBP or AVIF images by 90°, 180°, 270° or any angle, and mirror or flip them — up to 20 at a time.',
    alternates: { canonical: '/rotate' },
};

export default function RotatePage() {
    return (
        <ToolPage
            href="/rotate"
            title="Rotate & Flip"
            description="Turn a photo the right way up, or tilt it by any angle you type. Free angles expose the corners, which get filled with the color you choose — or left transparent."
        >
            <RotateForm />
        </ToolPage>
    );
}
