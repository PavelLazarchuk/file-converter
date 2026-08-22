import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

import { routing, type AppLocale } from '@/i18n/routing';
import { SITE, TOOLS, toolByHref, type Tool } from './site';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

const BACKGROUND = 'linear-gradient(135deg, #1b1830 0%, #2b2455 55%, #3a2f7a 100%)';

export function ogStaticParams() {
    return routing.locales.map(locale => ({ locale }));
}

function Frame({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '80px',
                background: BACKGROUND,
                color: '#ffffff',
                fontFamily: 'sans-serif',
            }}
        >
            {children}
        </div>
    );
}

function Brand({ accent }: { accent: readonly [string, string] }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
                style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: `linear-gradient(135deg, ${accent[0]}, ${accent[1]})`,
                }}
            />
            <div style={{ fontSize: '32px', color: '#c9c2ff' }}>{SITE.name}</div>
        </div>
    );
}

function Chip({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                padding: '10px 22px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(255,255,255,0.07)',
                fontSize: '26px',
                color: '#e6e2ff',
            }}
        >
            {children}
        </div>
    );
}

export async function renderSiteOgImage(locale: AppLocale): Promise<ImageResponse> {
    const t = await getTranslations({ locale, namespace: 'Landing' });
    const tools = await getTranslations({ locale, namespace: 'Tools' });

    return new ImageResponse(
        <Frame>
            <Brand accent={['#6d5ef0', '#4f3fd8']} />

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
                    <Chip key={tool.href}>{tools(`${tool.key}.title`)}</Chip>
                ))}
            </div>
        </Frame>,
        OG_SIZE
    );
}

export async function renderToolOgImage(locale: AppLocale, href: string): Promise<ImageResponse> {
    const tool = toolByHref(href);

    if (!tool) return renderSiteOgImage(locale);

    return renderToolImage(locale, tool);
}

async function renderToolImage(locale: AppLocale, tool: Tool): Promise<ImageResponse> {
    const tools = await getTranslations({ locale, namespace: 'Tools' });

    return new ImageResponse(
        <Frame>
            <Brand accent={tool.accent} />

            <div
                style={{
                    marginTop: '36px',
                    fontSize: '84px',
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                }}
            >
                {tools(`${tool.key}.title`)}
            </div>

            <div
                style={{
                    marginTop: '24px',
                    fontSize: '34px',
                    lineHeight: 1.35,
                    color: '#c9c2ff',
                }}
            >
                {tools(`${tool.key}.description`)}
            </div>

            <div
                style={{
                    display: 'flex',
                    marginTop: '48px',
                    width: '320px',
                    height: '10px',
                    borderRadius: '999px',
                    background: `linear-gradient(90deg, ${tool.accent[0]}, ${tool.accent[1]})`,
                }}
            />
        </Frame>,
        OG_SIZE
    );
}
