import { JsonLd } from '@/components/json-ld';
import { Landing } from '@/components/landing';
import { siteJsonLd } from '@/lib/site';

export default function Home() {
    return (
        <>
            <JsonLd data={siteJsonLd()} />
            <Landing />
        </>
    );
}
