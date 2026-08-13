import { cn } from '@/lib/utils';

const shape = 'origin-center [transform-box:fill-box] transition-transform duration-300 ease-out';

export function Logo({ className }: { className?: string }) {
    return (
        <svg aria-hidden viewBox="0 0 64 64" className={cn('size-6 rounded-md', className)}>
            <defs>
                <linearGradient id="site-logo-gradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#6d5ef0" />
                    <stop offset="1" stopColor="#4f3fd8" />
                </linearGradient>
            </defs>
            <rect width="64" height="64" rx="14" fill="url(#site-logo-gradient)" />
            <circle
                cx="43"
                cy="22"
                r="6"
                fill="#fff"
                opacity="0.9"
                className={cn(shape, 'group-hover:scale-125 motion-reduce:transition-none')}
            />
            <path
                d="M10 50 L26 28 L37 42 L44 34 L54 50 Z"
                fill="#fff"
                className={cn(
                    shape,
                    'group-hover:-translate-y-[3px] motion-reduce:transition-none'
                )}
            />
        </svg>
    );
}
