export interface SalesOrderLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesOrder {
  id: string;
  customerName: string;
  orderDate: string;
  lines: SalesOrderLine[];
  total: number;
}

export interface CreateOrderInput {
  customerName: string;
  orderDate: string;
}

export interface CreateLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
}
