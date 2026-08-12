import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IntegerInput } from '@/components/integer-input';

describe('IntegerInput', () => {
    it('is a numeric input', () => {
        render(<IntegerInput aria-label="Width" />);

        const input = screen.getByLabelText('Width');

        expect(input).toHaveAttribute('type', 'number');
        expect(input).toHaveAttribute('inputmode', 'numeric');
    });

    it('blocks the keystrokes that would make a non-integer', async () => {
        const user = userEvent.setup();

        render(<IntegerInput aria-label="Width" />);

        const input = screen.getByLabelText('Width');

        await user.click(input);
        await user.keyboard('12e-.,+34');

        expect(input).toHaveValue(1234);
    });

    it('still forwards keystrokes to a caller-supplied handler', async () => {
        const onKeyDown = vi.fn();
        const user = userEvent.setup();

        render(<IntegerInput aria-label="Width" onKeyDown={onKeyDown} />);

        await user.click(screen.getByLabelText('Width'));
        await user.keyboard('5');

        expect(onKeyDown).toHaveBeenCalled();
    });

    it('rejects a paste that is not a whole number', () => {
        render(<IntegerInput aria-label="Width" />);

        const input = screen.getByLabelText('Width');
        const blocked = fireEvent.paste(input, {
            clipboardData: { getData: () => '12.5px' },
        });
        const allowed = fireEvent.paste(input, {
            clipboardData: { getData: () => ' 640 ' },
        });

        expect(blocked).toBe(false);
        expect(allowed).toBe(true);
    });
});
