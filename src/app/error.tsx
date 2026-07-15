'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';

export default function Error({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <StatusPage
            code="500"
            title="Something went wrong"
            description="An unexpected error occurred while loading this page. Your images are untouched — try again, or head back to home page."
            footnote={error.digest ? `Error code: ${error.digest}` : undefined}
        >
            <Button onClick={() => unstable_retry()}>
                <RefreshCw /> Try again
            </Button>
            <Button variant="outline" asChild>
                <Link href="/">Back to Home</Link>
            </Button>
        </StatusPage>
    );
}
