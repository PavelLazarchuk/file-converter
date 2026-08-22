import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { render } from '@/test/intl';
import { FieldError } from '@/components/field-error';
import { fieldMessage } from '@/lib/form-messages';

const required = { type: 'required', message: fieldMessage({ k: 'required', label: 'width' }) };

describe('FieldError', () => {
    it('renders nothing when the field is valid', () => {
        const { container } = render(<FieldError id="width-error" />);

        expect(container).toBeEmptyDOMElement();
    });

    it('announces the message and carries the id the input describes itself with', () => {
        render(<FieldError id="width-error" error={required} />);

        const message = screen.getByRole('alert');

        expect(message).toHaveAttribute('id', 'width-error');
        expect(message).toHaveTextContent('Width is required');
    });
});
