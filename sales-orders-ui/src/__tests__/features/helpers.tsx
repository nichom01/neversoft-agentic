import { render, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';

export function renderApp(): UserEvent {
  const user = userEvent.setup();
  render(<App />);
  return user;
}

export async function createOrderViaUi(user: UserEvent, customerName: string, orderDate: string) {
  await user.type(screen.getByLabelText('Customer name'), customerName);
  await user.type(screen.getByLabelText('Order date'), orderDate);
  await user.click(screen.getByRole('button', { name: 'Create order' }));
}

export async function addLineViaUi(
  user: UserEvent,
  description: string,
  quantity: string,
  unitPrice: string,
) {
  if (description) await user.type(screen.getByLabelText('Description'), description);
  if (quantity) await user.type(screen.getByLabelText('Quantity'), quantity);
  if (unitPrice) await user.type(screen.getByLabelText('Unit price'), unitPrice);
  await user.click(screen.getByRole('button', { name: 'Add line' }));
}

export function orderListItem(customerName: string): HTMLElement {
  return within(screen.getByRole('region', { name: 'Orders' }))
    .getByRole('button', { name: new RegExp(customerName) })
    .closest('li') as HTMLElement;
}

export function detailView(customerName: string): HTMLElement {
  return screen.getByRole('region', { name: customerName });
}
