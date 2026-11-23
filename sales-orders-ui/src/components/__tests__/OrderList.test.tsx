import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SalesOrder } from '../../types';
import { OrderList } from '../OrderList';

const orders: SalesOrder[] = [
  {
    id: 'o1',
    customerName: 'Acme Ltd',
    orderDate: '2025-01-15',
    lines: [{ id: 'l1', description: 'Widget', quantity: 2, unitPrice: 10.5, total: 21 }],
    total: 21,
  },
  { id: 'o2', customerName: 'Globex', orderDate: '2025-02-01', lines: [], total: 0 },
];

describe('T-12 OrderList', () => {
  it('shows an empty state', () => {
    render(<OrderList orders={[]} selectedOrderId={null} onSelectOrder={vi.fn()} />);
    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
  });

  it('shows customer, date, line count and total for each order', () => {
    render(<OrderList orders={orders} selectedOrderId={null} onSelectOrder={vi.fn()} />);
    const [first, second] = screen.getAllByRole('listitem');
    expect(within(first).getByText('Acme Ltd')).toBeInTheDocument();
    expect(within(first).getByText('2025-01-15')).toBeInTheDocument();
    expect(within(first).getByText('1 line')).toBeInTheDocument();
    expect(within(first).getByText('21.00')).toBeInTheDocument();
    expect(within(second).getByText('Globex')).toBeInTheDocument();
    expect(within(second).getByText('0 lines')).toBeInTheDocument();
    expect(within(second).getByText('0.00')).toBeInTheDocument();
  });

  it('calls onSelectOrder with the order id on click', async () => {
    const onSelectOrder = vi.fn();
    render(<OrderList orders={orders} selectedOrderId={null} onSelectOrder={onSelectOrder} />);
    await userEvent.click(screen.getByRole('button', { name: /Globex/ }));
    expect(onSelectOrder).toHaveBeenCalledWith('o2');
  });

  it('marks the selected order', () => {
    render(<OrderList orders={orders} selectedOrderId="o1" onSelectOrder={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Acme Ltd/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Globex/ })).not.toHaveAttribute('aria-current');
  });
});
