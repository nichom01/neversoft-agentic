import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadOrders, saveOrders } from '../storage';
import type { SalesOrder } from '../types';

const KEY = 'sales_orders_v1';
const order: SalesOrder = { id: '1', customerName: 'A', orderDate: '2025-01-15', lines: [], total: 0 };

describe('T-20 loadOrders / saveOrders failure handling', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('returns [] for corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadOrders()).toEqual([]);
  });

  it.each([
    ['an object', '{"a":1}'],
    ['a string', '"hello"'],
    ['orders missing lines', JSON.stringify([{ id: '1', customerName: 'A', orderDate: 'd', total: 0 }])],
  ])('returns [] for valid JSON of the wrong shape (%s)', (_name, json) => {
    localStorage.setItem(KEY, json);
    expect(loadOrders()).toEqual([]);
  });

  it('does not throw when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveOrders([order])).not.toThrow();
  });

  it('returns [] when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(loadOrders()).toEqual([]);
  });
});
