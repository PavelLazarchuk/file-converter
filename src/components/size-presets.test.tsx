import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SizePresets } from '@/components/size-presets';
import { SIZE_PRESETS } from '@/lib/image';

function setup(activeKey: string | null = null, disabled = false) {
    const onSelect = vi.fn();

    render(
        <SizePresets
            activeKey={activeKey}
            disabled={disabled}
            hint="Fills the exact box a platform expects."
            onSelect={onSelect}
        />
    );

    return { onSelect, user: userEvent.setup() };
}

describe('SizePresets', () => {
    it('offers every preset with its pixel size', () => {
        setup();

        expect(screen.getAllByRole('button')).toHaveLength(SIZE_PRESETS.length);

        for (const preset of SIZE_PRESETS) {
            const button = screen.getByRole('button', {
                name: `${preset.label}${preset.width}×${preset.height}`,
            });

            expect(button).toHaveAttribute('aria-pressed', 'false');
        }
    });

    it('marks the active preset', () => {
        setup('avatar');

        const active = screen
            .getAllByRole('button')
            .filter(button => button.getAttribute('aria-pressed') === 'true');

        expect(active).toHaveLength(1);
        expect(active[0]).toHaveTextContent('Avatar');
    });

    it('hands the whole preset back on click', async () => {
        const { onSelect, user } = setup();

        await user.click(screen.getByRole('button', { name: /Instagram post/ }));

        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ key: 'instagram-post', width: 1080, height: 1080 })
        );
    });

    it('goes quiet while the action runs', async () => {
        const { onSelect, user } = setup(null, true);

        await user.click(screen.getByRole('button', { name: /Avatar/ }));

        expect(onSelect).not.toHaveBeenCalled();
    });
});
