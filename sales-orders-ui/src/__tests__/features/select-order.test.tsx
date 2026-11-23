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

describe('T-8 Feature: select between orders', () => {
  describe('Given orders "Acme Ltd" (Widget) and "Globex" (Gizmo) exist', () => {
    it('When the user selects each order Then its own lines are shown and new lines go to the selected order', async () => {
      const user = renderApp();
      await createOrderViaUi(user, 'Acme Ltd', '2025-01-15');
      await addLineViaUi(user, 'Widget', '1', '5');
      await createOrderViaUi(user, 'Globex', '2025-02-01');
      await addLineViaUi(user, 'Gizmo', '1', '7');

      await user.click(within(orderListItem('Globex')).getByRole('button'));
      let detail = detailView('Globex');
      expect(within(detail).getByText('Gizmo')).toBeInTheDocument();
      expect(screen.queryByText('Widget')).not.toBeInTheDocument();

      await user.click(within(orderListItem('Acme Ltd')).getByRole('button'));
      detail = detailView('Acme Ltd');
      expect(within(detail).getByText('Widget')).toBeInTheDocument();
      expect(screen.queryByText('Gizmo')).not.toBeInTheDocument();

      await addLineViaUi(user, 'Doohickey', '2', '3');
      expect(within(detailView('Acme Ltd')).getByText('Doohickey')).toBeInTheDocument();
      expect(within(orderListItem('Acme Ltd')).getByText('2 lines')).toBeInTheDocument();
      expect(within(orderListItem('Globex')).getByText('1 line')).toBeInTheDocument();
    });
  });
});
