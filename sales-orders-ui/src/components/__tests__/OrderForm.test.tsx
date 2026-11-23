import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrderForm } from '../OrderForm';

function setup() {
  const onCreateOrder = vi.fn();
  render(<OrderForm onCreateOrder={onCreateOrder} />);
  return { onCreateOrder, user: userEvent.setup() };
}

describe('T-10 OrderForm', () => {
  it('rejects an empty customer name', async () => {
    const { onCreateOrder, user } = setup();
    await user.type(screen.getByLabelText('Order date'), '2025-01-15');
    await user.click(screen.getByRole('button', { name: 'Create order' }));
    expect(screen.getByText('Customer name is required')).toBeInTheDocument();
    expect(onCreateOrder).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only customer name', async () => {
    const { onCreateOrder, user } = setup();
    await user.type(screen.getByLabelText('Customer name'), '   ');
    await user.type(screen.getByLabelText('Order date'), '2025-01-15');
    await user.click(screen.getByRole('button', { name: 'Create order' }));
    expect(screen.getByText('Customer name is required')).toBeInTheDocument();
    expect(onCreateOrder).not.toHaveBeenCalled();
  });

  it('rejects an empty date', async () => {
    const { onCreateOrder, user } = setup();
    await user.type(screen.getByLabelText('Customer name'), 'Acme Ltd');
    await user.click(screen.getByRole('button', { name: 'Create order' }));
    expect(screen.getByText('Order date is required')).toBeInTheDocument();
    expect(onCreateOrder).not.toHaveBeenCalled();
  });

  it('calls onCreateOrder once with trimmed values and resets the form', async () => {
    const { onCreateOrder, user } = setup();
    await user.type(screen.getByLabelText('Customer name'), '  Acme Ltd  ');
    await user.type(screen.getByLabelText('Order date'), '2025-01-15');
    await user.click(screen.getByRole('button', { name: 'Create order' }));
    expect(onCreateOrder).toHaveBeenCalledTimes(1);
    expect(onCreateOrder).toHaveBeenCalledWith({ customerName: 'Acme Ltd', orderDate: '2025-01-15' });
    expect(screen.getByLabelText('Customer name')).toHaveValue('');
    expect(screen.getByLabelText('Order date')).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
