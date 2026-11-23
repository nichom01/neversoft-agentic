import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrderLineForm } from '../OrderLineForm';

async function submit(values: { description?: string; quantity?: string; unitPrice?: string }) {
  const onAddLine = vi.fn();
  const user = userEvent.setup();
  render(<OrderLineForm onAddLine={onAddLine} />);
  if (values.description) await user.type(screen.getByLabelText('Description'), values.description);
  if (values.quantity) await user.type(screen.getByLabelText('Quantity'), values.quantity);
  if (values.unitPrice) await user.type(screen.getByLabelText('Unit price'), values.unitPrice);
  await user.click(screen.getByRole('button', { name: 'Add line' }));
  return onAddLine;
}

describe('T-11 OrderLineForm', () => {
  it.each(['', '   '])('rejects blank description %j', async (description) => {
    const onAddLine = await submit({ description, quantity: '1', unitPrice: '1' });
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(onAddLine).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '', 'abc'])('rejects quantity %j', async (quantity) => {
    const onAddLine = await submit({ description: 'Widget', quantity, unitPrice: '1' });
    expect(screen.getByText('Quantity must be greater than 0')).toBeInTheDocument();
    expect(onAddLine).not.toHaveBeenCalled();
  });

  it.each(['-5', '', 'abc'])('rejects unit price %j', async (unitPrice) => {
    const onAddLine = await submit({ description: 'Widget', quantity: '1', unitPrice });
    expect(screen.getByText('Unit price must be 0 or greater')).toBeInTheDocument();
    expect(onAddLine).not.toHaveBeenCalled();
  });

  it('accepts unit price 0 with quantity 1', async () => {
    const onAddLine = await submit({ description: 'Freebie', quantity: '1', unitPrice: '0' });
    expect(onAddLine).toHaveBeenCalledWith({ description: 'Freebie', quantity: 1, unitPrice: 0 });
  });

  it('passes numbers (not strings) for a fractional price and resets the form', async () => {
    const onAddLine = await submit({ description: ' Widget ', quantity: '2', unitPrice: '9.99' });
    expect(onAddLine).toHaveBeenCalledTimes(1);
    const arg = onAddLine.mock.calls[0][0];
    expect(arg).toEqual({ description: 'Widget', quantity: 2, unitPrice: 9.99 });
    expect(typeof arg.quantity).toBe('number');
    expect(typeof arg.unitPrice).toBe('number');
    expect(Number.isNaN(arg.quantity) || Number.isNaN(arg.unitPrice)).toBe(false);
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Quantity')).toHaveValue('');
    expect(screen.getByLabelText('Unit price')).toHaveValue('');
  });
});
