import { useEffect, useState } from 'react';
import { OrderDetail } from './components/OrderDetail';
import { OrderForm } from './components/OrderForm';
import { OrderList } from './components/OrderList';
import {
  addLineToOrder,
  createOrder,
  loadOrders,
  removeLineFromOrder,
  saveOrders,
} from './storage';
import type { CreateLineInput, CreateOrderInput, SalesOrder } from './types';

export function App() {
  const [orders, setOrders] = useState<SalesOrder[]>(() => loadOrders());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;

  function handleCreateOrder(input: CreateOrderInput) {
    const order = createOrder(input);
    setOrders((current) => [...current, order]);
    setSelectedOrderId(order.id);
  }

  function updateSelected(update: (order: SalesOrder) => SalesOrder) {
    setOrders((current) =>
      current.map((order) => (order.id === selectedOrderId ? update(order) : order)),
    );
  }

  function handleAddLine(input: CreateLineInput) {
    updateSelected((order) => addLineToOrder(order, input));
  }

  function handleRemoveLine(lineId: string) {
    updateSelected((order) => removeLineFromOrder(order, lineId));
  }

  return (
    <main className="app">
      <h1>Sales orders</h1>
      <div className="layout">
        <div className="column">
          <OrderForm onCreateOrder={handleCreateOrder} />
          <OrderList
            orders={orders}
            selectedOrderId={selectedOrderId}
            onSelectOrder={setSelectedOrderId}
          />
        </div>
        <div className="column">
          {selectedOrder ? (
            <OrderDetail
              order={selectedOrder}
              onAddLine={handleAddLine}
              onRemoveLine={handleRemoveLine}
            />
          ) : (
            <section className="card">
              <p className="empty">Select an order to view and edit its lines.</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
