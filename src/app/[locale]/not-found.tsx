import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { StatusPage } from '@/components/status-page';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('Status');

    return { title: t('notFoundTitle') };
}

export default async function NotFound() {
    const t = await getTranslations('Status');

    return (
        <StatusPage code="404" title={t('notFoundTitle')} description={t('notFoundDescription')}>
            <Button asChild>
                <Link href="/">
                    <ArrowLeft /> {t('backHome')}
                </Link>
            </Button>
        </StatusPage>
    );
}
