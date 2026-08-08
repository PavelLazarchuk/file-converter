import type { Metadata } from 'next';

import { MAX_FILE_SIZE_LABEL } from '@/lib/image';

export const metadata: Metadata = {
    title: 'Privacy',
    description:
        'What happens to the images you upload: processed in memory on the server, never stored, metadata stripped by default.',
    alternates: { canonical: '/privacy' },
};

const sections = [
    {
        title: 'Where your images are processed',
        body: [
            `Processing happens on the server, not in your browser. When you press the button, the file is sent over HTTPS to a Server Action, decoded in memory by sharp, and the result comes straight back in the response.`,
            `Nothing is written to disk, no database, no object storage, no queue. Once the request finishes, the memory holding your image is released. There is no copy left to download, index or share, and no URL that points at your file.`,
        ],
    },
    {
        title: 'What is not collected',
        body: [
            `No accounts, no sign-up, no email address. There is no upload history, because nothing is kept to build one from.`,
            `The only thing stored in your browser is your light/dark theme choice, in localStorage. No tracking cookies are set.`,
        ],
    },
    {
        title: 'Analytics',
        body: [
            `The site uses Vercel Analytics and Vercel Speed Insights, which record anonymous page views and page-load timings. They see which tool page was opened and how fast it rendered — never the images, filenames or settings you use.`,
            `If processing fails, the error itself is logged to the server console so the bug can be fixed. The image is not part of that log.`,
        ],
    },
    {
        title: 'Metadata in your files',
        body: [
            `Every tool bakes the EXIF orientation into the pixels, so a photo can never come out rotated after its orientation tag is dropped.`,
            `Compress always removes all metadata (EXIF, GPS coordinates, ICC profile, XMP). Resize, crop and convert remove it by default and offer a switch to keep it — worth remembering that GPS coordinates travel inside photos taken on a phone.`,
        ],
    },
    {
        title: 'Limits',
        body: [
            `Uploads are capped at ${MAX_FILE_SIZE_LABEL} and 100 megapixels per image. These limits exist to keep the server responsive, not to collect anything.`,
        ],
    },
] as const;

export default function PrivacyPage() {
    return (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-16">
            <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
            <p className="mt-2 text-muted-foreground">
                The short version: your images are processed in memory and never stored.
            </p>

            <div className="mt-10 space-y-8">
                {sections.map(section => (
                    <section key={section.title}>
                        <h2 className="text-lg font-semibold">{section.title}</h2>
                        {section.body.map(paragraph => (
                            <p
                                key={paragraph}
                                className="mt-3 leading-relaxed text-muted-foreground"
                            >
                                {paragraph}
                            </p>
                        ))}
                    </section>
                ))}
            </div>
        </main>
    );
}
