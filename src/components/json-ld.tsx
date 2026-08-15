import { jsonLdScript, type JsonLd as JsonLdData } from '@/lib/site';

export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
    const blocks = Array.isArray(data) ? data : [data];

    return (
        <>
            {blocks.map((block, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: jsonLdScript(block) }}
                />
            ))}
        </>
    );
}
