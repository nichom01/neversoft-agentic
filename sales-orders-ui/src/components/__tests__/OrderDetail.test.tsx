import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SalesOrder } from '../../types';
import { OrderDetail } from '../OrderDetail';

const order: SalesOrder = {
  id: 'o1',
  customerName: 'Acme Ltd',
  orderDate: '2025-01-15',
  lines: [
    { id: 'l1', description: 'Widget', quantity: 2, unitPrice: 10.5, total: 21 },
    { id: 'l2', description: 'Gadget', quantity: 3, unitPrice: 4, total: 12 },
  ],
  total: 33,
};

describe('T-13 OrderDetail', () => {
  it('shows each line with formatted money and the order total', () => {
    render(<OrderDetail order={order} onAddLine={vi.fn()} onRemoveLine={vi.fn()} />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Widget')).toBeInTheDocument();
    expect(within(rows[0]).getByText('2')).toBeInTheDocument();
    expect(within(rows[0]).getByText('10.50')).toBeInTheDocument();
    expect(within(rows[0]).getByText('21.00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('12.00')).toBeInTheDocument();
    expect(screen.getByTestId('order-total')).toHaveTextContent('33.00');
  });

  it('shows an empty state and total 0.00 when there are no lines', () => {
    render(<OrderDetail order={{ ...order, lines: [], total: 0 }} onAddLine={vi.fn()} onRemoveLine={vi.fn()} />);
    expect(screen.getByText('No lines yet.')).toBeInTheDocument();
    expect(screen.getByTestId('order-total')).toHaveTextContent('0.00');
  });

  it('calls onRemoveLine with the line id', async () => {
    const onRemoveLine = vi.fn();
    render(<OrderDetail order={order} onAddLine={vi.fn()} onRemoveLine={onRemoveLine} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove line Widget' }));
    expect(onRemoveLine).toHaveBeenCalledWith('l1');
  });

  it('calls onAddLine when the embedded form is submitted', async () => {
    const onAddLine = vi.fn();
    const user = userEvent.setup();
    render(<OrderDetail order={order} onAddLine={onAddLine} onRemoveLine={vi.fn()} />);
    await user.type(screen.getByLabelText('Description'), 'Gizmo');
    await user.type(screen.getByLabelText('Quantity'), '1');
    await user.type(screen.getByLabelText('Unit price'), '2.5');
    await user.click(screen.getByRole('button', { name: 'Add line' }));
    expect(onAddLine).toHaveBeenCalledWith({ description: 'Gizmo', quantity: 1, unitPrice: 2.5 });
  });
});
