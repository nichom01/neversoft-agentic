import { cleanup, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addLineViaUi,
  createOrderViaUi,
  detailView,
  orderListItem,
  renderApp,
} from './helpers';

beforeEach(() => localStorage.clear());

describe('T-9 Feature: orders survive a page reload', () => {
  describe('Given the user created order "Acme Ltd" with line "Widget"', () => {
    it('When the page is reloaded Then the order, line and totals are still there', async () => {
      const user = renderApp();
      await createOrderViaUi(user, 'Acme Ltd', '2025-01-15');
      await addLineViaUi(user, 'Widget', '2', '10.50');

      cleanup(); // unmount; localStorage is kept
      const user2 = renderApp();

      const item = orderListItem('Acme Ltd');
      expect(within(item).getByText('1 line')).toBeInTheDocument();
      expect(within(item).getByText('21.00')).toBeInTheDocument();

      await user2.click(within(item).getByRole('button'));
      const detail = detailView('Acme Ltd');
      expect(within(detail).getByText('Widget')).toBeInTheDocument();
      expect(within(detail).getByTestId('order-total')).toHaveTextContent('21.00');
      expect(screen.queryByText('No orders yet.')).not.toBeInTheDocument();
    });
  });
});
