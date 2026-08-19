'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { Logger } from '@/lib/logger';

export default function Error({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) {
    const t = useTranslations('Status');

    useEffect(() => {
        Logger.error('render.crashed', { digest: error.digest, error });
    }, [error]);

    return (
        <StatusPage
            code="500"
            title={t('errorTitle')}
            description={t('errorDescription')}
            footnote={error.digest ? t('errorCode', { digest: error.digest }) : undefined}
        >
            <Button onClick={() => unstable_retry()}>
                <RefreshCw /> {t('tryAgain')}
            </Button>
            <Button variant="outline" asChild>
                <Link href="/">{t('backHome')}</Link>
            </Button>
        </StatusPage>
    );
}
