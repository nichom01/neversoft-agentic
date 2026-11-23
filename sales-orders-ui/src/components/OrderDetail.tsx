import type { CreateLineInput, SalesOrder } from '../types';
import { OrderLineForm } from './OrderLineForm';

export interface OrderDetailProps {
  order: SalesOrder;
  onAddLine: (input: CreateLineInput) => void;
  onRemoveLine: (lineId: string) => void;
}

export function OrderDetail({ order, onAddLine, onRemoveLine }: OrderDetailProps) {
  return (
    <section className="card" aria-labelledby="detail-heading">
      <h2 id="detail-heading">{order.customerName}</h2>
      <p className="order-date">{order.orderDate}</p>
      {order.lines.length === 0 ? (
        <p className="empty">No lines yet.</p>
      ) : (
        <table className="lines-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Quantity</th>
              <th className="num">Unit price</th>
              <th className="num">Line total</th>
              <th>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td className="num">{line.quantity}</td>
                <td className="num">{line.unitPrice.toFixed(2)}</td>
                <td className="num">{line.total.toFixed(2)}</td>
                <td>
                  <button
                    type="button"
                    className="danger"
                    aria-label={`Remove line ${line.description}`}
                    onClick={() => onRemoveLine(line.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="order-total-row">
        <span>Order total</span>
        <strong data-testid="order-total">{order.total.toFixed(2)}</strong>
      </p>
      <OrderLineForm onAddLine={onAddLine} />
    </section>
  );
}
