import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CreateLineInput } from '../types';

export interface OrderLineFormProps {
  onAddLine: (input: CreateLineInput) => void;
}

interface LineFormErrors {
  description?: string;
  quantity?: string;
  unitPrice?: string;
}

function parseNumber(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return NaN;
  return Number(trimmed);
}

export function OrderLineForm({ onAddLine }: OrderLineFormProps) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [errors, setErrors] = useState<LineFormErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const desc = description.trim();
    const qty = parseNumber(quantity);
    const price = parseNumber(unitPrice);
    const next: LineFormErrors = {};
    if (desc === '') next.description = 'Description is required';
    if (!Number.isFinite(qty) || qty <= 0) next.quantity = 'Quantity must be greater than 0';
    if (!Number.isFinite(price) || price < 0) next.unitPrice = 'Unit price must be 0 or greater';
    setErrors(next);
    if (next.description || next.quantity || next.unitPrice) return;
    onAddLine({ description: desc, quantity: qty, unitPrice: price });
    setDescription('');
    setQuantity('');
    setUnitPrice('');
  }

  return (
    <form className="form line-form" onSubmit={handleSubmit} noValidate>
      <h3>Add line</h3>
      <div className="field">
        <label htmlFor="lineDescription">Description</label>
        <input
          id="lineDescription"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={errors.description ? true : undefined}
        />
        {errors.description && (
          <p className="error" role="alert">
            {errors.description}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="lineQuantity">Quantity</label>
        <input
          id="lineQuantity"
          type="text"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-invalid={errors.quantity ? true : undefined}
        />
        {errors.quantity && (
          <p className="error" role="alert">
            {errors.quantity}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="lineUnitPrice">Unit price</label>
        <input
          id="lineUnitPrice"
          type="text"
          inputMode="decimal"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          aria-invalid={errors.unitPrice ? true : undefined}
        />
        {errors.unitPrice && (
          <p className="error" role="alert">
            {errors.unitPrice}
          </p>
        )}
      </div>
      <button type="submit">Add line</button>
    </form>
  );
}
