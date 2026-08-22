import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { render } from '@/test/intl';
import type { LoadedImage } from '@/components/image-dropzone';
import type { CropBox } from '@/lib/image';
import { CropArea } from './crop-area';

const image = {
    file: new File(['x'], 'photo.png', { type: 'image/png' }),
    previewUrl: 'blob:photo',
    width: 200,
    height: 100,
} as unknown as LoadedImage;

const box: CropBox = { left: 40, top: 20, width: 80, height: 40 };

function setup({
    ratio = null,
    disabled = false,
}: { ratio?: CropBox | null; disabled?: boolean } = {}) {
    const onChange = vi.fn<(next: CropBox) => void>();

    render(
        <CropArea
            image={image}
            ratio={ratio ? { width: ratio.width, height: ratio.height } : null}
            box={box}
            shape="rectangle"
            disabled={disabled}
            onChange={onChange}
        />
    );

    return { onChange, user: userEvent.setup() };
}

function frame() {
    return screen.getByRole('group');
}

describe('CropArea', () => {
    it('names the frame by where it sits and how big it is', () => {
        setup();

        expect(frame()).toHaveAccessibleName(
            'Crop frame, 80 by 40 pixels, 40 pixels from the left and 20 from the top'
        );
    });

    it('moves the frame with the arrow keys once it is focused', async () => {
        const { onChange, user } = setup();

        await user.tab();
        expect(frame()).toHaveFocus();

        await user.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenLastCalledWith({ ...box, left: 41 });

        await user.keyboard('{ArrowUp}');
        expect(onChange).toHaveBeenLastCalledWith({ ...box, top: 19 });
    });

    it('takes bigger steps with Shift held', async () => {
        const { onChange, user } = setup();

        await user.tab();
        await user.keyboard('{Shift>}{ArrowDown}{/Shift}');

        expect(onChange).toHaveBeenLastCalledWith({ ...box, top: 30 });
    });

    it('resizes instead of moving when Alt is held', async () => {
        const { onChange, user } = setup();

        await user.tab();
        await user.keyboard('{Alt>}{ArrowRight}{/Alt}');

        expect(onChange).toHaveBeenLastCalledWith({ ...box, width: 81 });
    });

    it('keeps a locked ratio while resizing from the keyboard', async () => {
        const { onChange, user } = setup({ ratio: { ...box, width: 2, height: 1 } });

        await user.tab();
        await user.keyboard('{Alt>}{ArrowRight}{/Alt}');

        const next = onChange.mock.lastCall?.[0] as CropBox;

        expect(next.width / next.height).toBeCloseTo(2, 1);
        expect(next.width).toBeGreaterThan(box.width);
    });

    it('clamps a nudge at the edge of the photo instead of running past it', async () => {
        const { onChange, user } = setup();

        await user.tab();

        for (let press = 0; press < 12; press += 1) {
            await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
        }

        for (const call of onChange.mock.calls) {
            expect(call[0].left + call[0].width).toBeLessThanOrEqual(image.width);
        }
    });

    it('takes no keyboard focus while the form is busy', () => {
        setup({ disabled: true });

        expect(frame()).toHaveAttribute('tabindex', '-1');
    });
});
