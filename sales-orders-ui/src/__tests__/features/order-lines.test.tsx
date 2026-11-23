import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addLineViaUi,
  createOrderViaUi,
  detailView,
  orderListItem,
  renderApp,
} from './helpers';

beforeEach(() => localStorage.clear());

async function setupOrderWithTwoLines() {
  const user = renderApp();
  await createOrderViaUi(user, 'Acme Ltd', '2025-01-15');
  await addLineViaUi(user, 'Widget', '2', '10.50');
  await addLineViaUi(user, 'Gadget', '3', '4.00');
  return user;
}

describe('T-5 Feature: add lines and see totals', () => {
  describe('Given an order for "Acme Ltd" is selected', () => {
    it('When two lines are added Then line totals, order total and list are consistent', async () => {
      await setupOrderWithTwoLines();
      const detail = detailView('Acme Ltd');
      const rows = within(within(detail).getByRole('table')).getAllByRole('row').slice(1);
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText('Widget')).toBeInTheDocument();
      expect(within(rows[0]).getByText('21.00')).toBeInTheDocument();
      expect(within(rows[1]).getByText('Gadget')).toBeInTheDocument();
      expect(within(rows[1]).getByText('12.00')).toBeInTheDocument();
      expect(within(detail).getByTestId('order-total')).toHaveTextContent('33.00');
      const item = orderListItem('Acme Ltd');
      expect(within(item).getByText('2 lines')).toBeInTheDocument();
      expect(within(item).getByText('33.00')).toBeInTheDocument();
    });
  });
});

describe('T-6 Feature: invalid lines are rejected', () => {
  describe('Given an order for "Acme Ltd" is selected', () => {
    // Scenario outline examples: description, quantity, unit price, expected error
    it.each([
      ['Widget', '0', '5', 'Quantity must be greater than 0'],
      ['Widget', '-1', '5', 'Quantity must be greater than 0'],
      ['Widget', '1', '-5', 'Unit price must be 0 or greater'],
      ['', '1', '5', 'Description is required'],
    ])(
      'When the user submits "%s", qty "%s", price "%s" Then "%s" is shown and no line is added',
      async (description, quantity, unitPrice, error) => {
        const user = renderApp();
        await createOrderViaUi(user, 'Acme Ltd', '2025-01-15');
        await addLineViaUi(user, description, quantity, unitPrice);
        const detail = detailView('Acme Ltd');
        expect(within(detail).getByText(error)).toBeInTheDocument();
        expect(within(detail).queryByRole('table')).not.toBeInTheDocument();
        expect(within(detail).getByTestId('order-total')).toHaveTextContent('0.00');
      },
    );

    it('When the user submits quantity 1 and unit price 0 Then the line is added with total 0.00', async () => {
      const user = renderApp();
      await createOrderViaUi(user, 'Acme Ltd', '2025-01-15');
      await addLineViaUi(user, 'Freebie', '1', '0');
      const detail = detailView('Acme Ltd');
      const row = within(within(detail).getByRole('table')).getAllByRole('row')[1];
      expect(within(row).getByText('Freebie')).toBeInTheDocument();
      expect(within(row).getAllByText('0.00')).toHaveLength(2);
      expect(within(detail).getByTestId('order-total')).toHaveTextContent('0.00');
    });
  });
});

describe('T-7 Feature: remove a line', () => {
  describe('Given an order has lines "Widget" (21.00) and "Gadget" (12.00)', () => {
    it('When the user removes "Widget" Then only "Gadget" remains and totals are 12.00', async () => {
      const user = await setupOrderWithTwoLines();
      await user.click(screen.getByRole('button', { name: 'Remove line Widget' }));
      const detail = detailView('Acme Ltd');
      expect(within(detail).queryByText('Widget')).not.toBeInTheDocument();
      expect(within(detail).getByText('Gadget')).toBeInTheDocument();
      expect(within(detail).getByTestId('order-total')).toHaveTextContent('12.00');
      const item = orderListItem('Acme Ltd');
      expect(within(item).getByText('1 line')).toBeInTheDocument();
      expect(within(item).getByText('12.00')).toBeInTheDocument();
    });
  });
});
