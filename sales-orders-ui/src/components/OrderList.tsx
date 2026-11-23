import type { SalesOrder } from '../types';

export interface OrderListProps {
  orders: SalesOrder[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
}

export function OrderList({ orders, selectedOrderId, onSelectOrder }: OrderListProps) {
  return (
    <section className="card" aria-labelledby="orders-heading">
      <h2 id="orders-heading">Orders</h2>
      {orders.length === 0 ? (
        <p className="empty">No orders yet.</p>
      ) : (
        <ul className="order-list">
          {orders.map((order) => {
            const selected = order.id === selectedOrderId;
            return (
              <li key={order.id}>
                <button
                  type="button"
                  className={selected ? 'order-item selected' : 'order-item'}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelectOrder(order.id)}
                >
                  <span className="order-customer">{order.customerName}</span>
                  <span className="order-date">{order.orderDate}</span>
                  <span className="badge">
                    {order.lines.length} {order.lines.length === 1 ? 'line' : 'lines'}
                  </span>
                  <span className="order-total">{order.total.toFixed(2)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
