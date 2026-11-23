import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CreateOrderInput } from '../types';

export interface OrderFormProps {
  onCreateOrder: (input: CreateOrderInput) => void;
}

interface OrderFormErrors {
  customerName?: string;
  orderDate?: string;
}

export function OrderForm({ onCreateOrder }: OrderFormProps) {
  const [customerName, setCustomerName] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [errors, setErrors] = useState<OrderFormErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = customerName.trim();
    const date = orderDate.trim();
    const next: OrderFormErrors = {};
    if (name === '') next.customerName = 'Customer name is required';
    if (date === '') next.orderDate = 'Order date is required';
    setErrors(next);
    if (next.customerName || next.orderDate) return;
    onCreateOrder({ customerName: name, orderDate: date });
    setCustomerName('');
    setOrderDate('');
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <h2>New sales order</h2>
      <div className="field">
        <label htmlFor="customerName">Customer name</label>
        <input
          id="customerName"
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          aria-invalid={errors.customerName ? true : undefined}
        />
        {errors.customerName && (
          <p className="error" role="alert">
            {errors.customerName}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="orderDate">Order date</label>
        <input
          id="orderDate"
          type="date"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
          aria-invalid={errors.orderDate ? true : undefined}
        />
        {errors.orderDate && (
          <p className="error" role="alert">
            {errors.orderDate}
          </p>
        )}
      </div>
      <button type="submit">Create order</button>
    </form>
  );
}
