import { beforeEach, describe, expect, it } from 'vitest';
import { addLineToOrder, createOrder, loadOrders, saveOrders } from '../storage';

describe('T-14 storage against real localStorage', () => {
  beforeEach(() => localStorage.clear());

  it('returns [] when nothing is stored', () => {
    expect(loadOrders()).toEqual([]);
  });

  it('saveOrders writes JSON under sales_orders_v1', () => {
    const order = createOrder({ customerName: 'Acme Ltd', orderDate: '2025-01-15' });
    saveOrders([order]);
    const raw = localStorage.getItem('sales_orders_v1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual([order]);
  });

  it('round-trips nested lines and totals', () => {
    const order = addLineToOrder(
      createOrder({ customerName: 'Acme Ltd', orderDate: '2025-01-15' }),
      { description: 'Widget', quantity: 2, unitPrice: 10.5 },
    );
    saveOrders([order]);
    expect(loadOrders()).toEqual([order]);
  });
});
