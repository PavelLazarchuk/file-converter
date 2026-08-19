import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

import { routing, type AppLocale } from '@/i18n/routing';
import { SITE, TOOLS } from '@/lib/site';

export const alt = SITE.name;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
    return routing.locales.map(locale => ({ locale }));
}

export default async function OpengraphImage({
    params,
}: {
    params: Promise<{ locale: AppLocale }>;
}) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Landing' });
    const tools = await getTranslations({ locale, namespace: 'Tools' });

    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '80px',
                background: 'linear-gradient(135deg, #1b1830 0%, #2b2455 55%, #3a2f7a 100%)',
                color: '#ffffff',
                fontFamily: 'sans-serif',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #6d5ef0, #4f3fd8)',
                    }}
                />
                <div style={{ fontSize: '32px', color: '#c9c2ff' }}>{SITE.name}</div>
            </div>

            <div
                style={{
                    marginTop: '36px',
                    fontSize: '76px',
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                }}
            >
                {t('headline')}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '44px' }}>
                {TOOLS.map(tool => (
                    <div
                        key={tool.href}
                        style={{
                            padding: '10px 22px',
                            borderRadius: '999px',
                            border: '1px solid rgba(255,255,255,0.22)',
                            background: 'rgba(255,255,255,0.07)',
                            fontSize: '26px',
                            color: '#e6e2ff',
                        }}
                    >
                        {tools(`${tool.key}.title`)}
                    </div>
                ))}
            </div>
        </div>,
        size
    );
}
