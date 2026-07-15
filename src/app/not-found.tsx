import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
    title: 'Page not found — Image Toolbox',
};

export default function NotFound() {
    return (
        <StatusPage
            code="404"
            title="Page not found"
            description="The page you're looking for doesn't exist or may have been moved."
        >
            <Button asChild>
                <Link href="/">
                    <ArrowLeft /> Back to Home
                </Link>
            </Button>
        </StatusPage>
    );
}
