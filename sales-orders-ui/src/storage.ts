import type {
  CreateLineInput,
  CreateOrderInput,
  SalesOrder,
  SalesOrderLine,
} from './types';

const STORAGE_KEY = 'sales_orders_v1';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function generateId(): string {
  return globalThis.crypto.randomUUID();
}

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}

export function calculateOrderTotal(lines: SalesOrderLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.total, 0));
}

function isLine(value: unknown): value is SalesOrderLine {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.description === 'string' &&
    typeof v.quantity === 'number' &&
    typeof v.unitPrice === 'number' &&
    typeof v.total === 'number'
  );
}

function isOrder(value: unknown): value is SalesOrder {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.customerName === 'string' &&
    typeof v.orderDate === 'string' &&
    typeof v.total === 'number' &&
    Array.isArray(v.lines) &&
    v.lines.every(isLine)
  );
}

export function loadOrders(): SalesOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isOrder)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveOrders(orders: SalesOrder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Storage unavailable (quota or private mode): keep working in memory.
  }
}

export function createOrder(input: CreateOrderInput): SalesOrder {
  return {
    id: generateId(),
    customerName: input.customerName,
    orderDate: input.orderDate,
    lines: [],
    total: 0,
  };
}

export function addLineToOrder(order: SalesOrder, lineInput: CreateLineInput): SalesOrder {
  const line: SalesOrderLine = {
    id: generateId(),
    description: lineInput.description,
    quantity: lineInput.quantity,
    unitPrice: lineInput.unitPrice,
    total: calculateLineTotal(lineInput.quantity, lineInput.unitPrice),
  };
  const lines = [...order.lines, line];
  return { ...order, lines, total: calculateOrderTotal(lines) };
}

export function removeLineFromOrder(order: SalesOrder, lineId: string): SalesOrder {
  const lines = order.lines.filter((line) => line.id !== lineId);
  return { ...order, lines, total: calculateOrderTotal(lines) };
}
