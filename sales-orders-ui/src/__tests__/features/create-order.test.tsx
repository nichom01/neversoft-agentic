import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createOrderViaUi, detailView, orderListItem, renderApp } from './helpers';

beforeEach(() => localStorage.clear());

describe('T-3 Feature: create a sales order', () => {
  describe('Given the sales orders page is open with no orders', () => {
    describe('When the user submits customer "Acme Ltd" and date "2025-01-15"', () => {
      it('Then the order is listed with 0 lines and total 0.00, and its detail view is shown', async () => {
        const user = renderApp();
        expect(screen.getByText('No orders yet.')).toBeInTheDocument();

        await createOrderViaUi(user, 'Acme Ltd', '2025-01-15');

        const item = orderListItem('Acme Ltd');
        expect(within(item).getByText('Acme Ltd')).toBeInTheDocument();
        expect(within(item).getByText('2025-01-15')).toBeInTheDocument();
        expect(within(item).getByText('0 lines')).toBeInTheDocument();
        expect(within(item).getByText('0.00')).toBeInTheDocument();
        expect(within(item).getByRole('button')).toHaveAttribute('aria-current', 'true');
        expect(within(detailView('Acme Ltd')).getByTestId('order-total')).toHaveTextContent('0.00');
      });
    });
  });
});

describe('T-4 Feature: required order fields are validated', () => {
  describe('Given the sales orders page is open', () => {
    it('When the customer name is empty Then an error is shown and no order is added; same for an empty date', async () => {
      const user = renderApp();

      await user.type(screen.getByLabelText('Order date'), '2025-01-15');
      await user.click(screen.getByRole('button', { name: 'Create order' }));
      expect(screen.getByText('Customer name is required')).toBeInTheDocument();
      expect(screen.getByText('No orders yet.')).toBeInTheDocument();

      await user.clear(screen.getByLabelText('Order date'));
      await user.type(screen.getByLabelText('Customer name'), 'Acme Ltd');
      await user.click(screen.getByRole('button', { name: 'Create order' }));
      expect(screen.getByText('Order date is required')).toBeInTheDocument();
      expect(screen.queryByText('Customer name is required')).not.toBeInTheDocument();
      expect(screen.getByText('No orders yet.')).toBeInTheDocument();
    });
  });
});
