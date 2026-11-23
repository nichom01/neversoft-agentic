import { describe, expect, it } from 'vitest';
import {
  addLineToOrder,
  calculateLineTotal,
  calculateOrderTotal,
  createOrder,
  removeLineFromOrder,
} from '../storage';
import type { SalesOrder, SalesOrderLine } from '../types';

function line(total: number, id = String(total)): SalesOrderLine {
  return { id, description: 'x', quantity: 1, unitPrice: total, total };
}

describe('T-15 calculateLineTotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(calculateLineTotal(2, 10.5)).toBe(21);
  });
  it('returns 0 for a zero unit price', () => {
    expect(calculateLineTotal(1, 0)).toBe(0);
  });
  it('avoids float artefacts', () => {
    expect(calculateLineTotal(3, 0.1)).toBe(0.3);
  });
  it('rounds to 2 decimals', () => {
    expect(calculateLineTotal(3, 19.99)).toBe(59.97);
  });
  it('handles large quantities', () => {
    expect(calculateLineTotal(1_000_000, 99.99)).toBe(99_990_000);
  });
});

describe('T-16 calculateOrderTotal', () => {
  it('is 0 for no lines', () => {
    expect(calculateOrderTotal([])).toBe(0);
  });
  it('is the line total for a single line', () => {
    expect(calculateOrderTotal([line(12.34)])).toBe(12.34);
  });
  it('sums several lines', () => {
    expect(calculateOrderTotal([line(21), line(12, 'b')])).toBe(33);
  });
  it('avoids float drift', () => {
    expect(calculateOrderTotal([line(0.1), line(0.2, 'b')])).toBe(0.3);
  });
  it('includes zero-total lines', () => {
    expect(calculateOrderTotal([line(0), line(5, 'b')])).toBe(5);
  });
});

describe('T-17 createOrder', () => {
  it('returns an empty order with the given header', () => {
    const order = createOrder({ customerName: 'Acme Ltd', orderDate: '2025-01-15' });
    expect(order.customerName).toBe('Acme Ltd');
    expect(order.orderDate).toBe('2025-01-15');
    expect(order.lines).toEqual([]);
    expect(order.total).toBe(0);
    expect(order.id).not.toBe('');
  });
  it('gives unique ids', () => {
    const input = { customerName: 'A', orderDate: '2025-01-15' };
    expect(createOrder(input).id).not.toBe(createOrder(input).id);
  });
  it('does not mutate the input', () => {
    const input = { customerName: 'A', orderDate: '2025-01-15' };
    createOrder(input);
    expect(input).toEqual({ customerName: 'A', orderDate: '2025-01-15' });
  });
});

describe('T-18 addLineToOrder', () => {
  const base = (): SalesOrder =>
    createOrder({ customerName: 'Acme Ltd', orderDate: '2025-01-15' });

  it('appends a line with computed totals', () => {
    const order = addLineToOrder(base(), { description: 'Widget', quantity: 2, unitPrice: 10.5 });
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]).toMatchObject({
      description: 'Widget',
      quantity: 2,
      unitPrice: 10.5,
      total: calculateLineTotal(2, 10.5),
    });
    expect(order.total).toBe(21);
  });
  it('keeps existing line order and gives unique ids', () => {
    const one = addLineToOrder(base(), { description: 'A', quantity: 1, unitPrice: 1 });
    const two = addLineToOrder(one, { description: 'B', quantity: 3, unitPrice: 4 });
    expect(two.lines.map((l) => l.description)).toEqual(['A', 'B']);
    expect(two.lines[0].id).not.toBe(two.lines[1].id);
    expect(two.total).toBe(13);
  });
  it('does not mutate the original order', () => {
    const original = base();
    const lines = original.lines;
    const updated = addLineToOrder(original, { description: 'A', quantity: 1, unitPrice: 1 });
    expect(updated).not.toBe(original);
    expect(original.lines).toBe(lines);
    expect(original.lines).toEqual([]);
    expect(original.total).toBe(0);
  });
});

describe('T-19 removeLineFromOrder', () => {
  const twoLines = () => {
    const o = createOrder({ customerName: 'Acme Ltd', orderDate: '2025-01-15' });
    return addLineToOrder(
      addLineToOrder(o, { description: 'Widget', quantity: 2, unitPrice: 10.5 }),
      { description: 'Gadget', quantity: 3, unitPrice: 4 },
    );
  };

  it('removes only the given line and recomputes the total', () => {
    const order = twoLines();
    const updated = removeLineFromOrder(order, order.lines[0].id);
    expect(updated.lines.map((l) => l.description)).toEqual(['Gadget']);
    expect(updated.total).toBe(12);
  });
  it('gives total 0 when the last line is removed', () => {
    const order = addLineToOrder(
      createOrder({ customerName: 'A', orderDate: '2025-01-15' }),
      { description: 'A', quantity: 1, unitPrice: 5 },
    );
    expect(removeLineFromOrder(order, order.lines[0].id).total).toBe(0);
  });
  it('leaves the order unchanged for an unknown id', () => {
    const order = twoLines();
    const updated = removeLineFromOrder(order, 'nope');
    expect(updated.lines).toEqual(order.lines);
    expect(updated.total).toBe(order.total);
  });
  it('does not mutate the original order', () => {
    const order = twoLines();
    removeLineFromOrder(order, order.lines[0].id);
    expect(order.lines).toHaveLength(2);
    expect(order.total).toBe(33);
  });
});
