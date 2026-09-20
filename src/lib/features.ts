import { STORE } from '@/lib/storeConfig';

/**
 * Ordering directly from the store - the cart, the checkout and the Square
 * payment flow - is built but not switched on. Payments aren't connected yet,
 * and visitors were mistaking the test checkout for a real one.
 *
 * While this is false, every purchase points at our Bookshop.org affiliate
 * storefront: a real, working way to buy that still supports the store. None
 * of the store-ordering code has been removed - flip this to true to bring the
 * cart, checkout and pickup/ship options back.
 */
export const STORE_ORDERING_ENABLED = false;

/**
 * The catalogue's inventory numbers come from a POS export whose most recent
 * movement is February 2026, and the database is not the store's record of
 * truth yet. Until it is, the site makes no claim about what is on the shelf:
 * a seven month old "only 1 left" sends people on a wasted trip, and plenty
 * of the titles marked sold out are sitting in the shop right now.
 *
 * Flip this to true once the POS sync is live and the numbers can be trusted.
 */
export const INVENTORY_STATUS_IS_LIVE = false;

/**
 * True when a title should be bought through Bookshop.org rather than added to
 * the store's own cart. "Available to Order" titles always went this way, since
 * the store doesn't hold them.
 */
export function buysThroughBookshop(status: string) {
  return !STORE_ORDERING_ENABLED || status === 'Available to Order';
}

/**
 * What to tell someone under a Bookshop.org button. A title sitting on our
 * shelves shouldn't be described as shipping from a warehouse.
 */
export function bookshopBuyNote(status: string) {
  // With no trustworthy stock figures, every title gets the same offer: order
  // online, or ring the shop and let a person look. That is useful whatever
  // the shelf actually holds, and it never promises a copy that isn't there.
  if (!INVENTORY_STATUS_IS_LIVE) {
    return status === 'Preorder'
      ? `Preorder through Bookshop.org, or call ${STORE.phone} to reserve a copy with us.`
      : `Order through Bookshop.org, or call ${STORE.phone} to see if it's on our shelves.`;
  }

  if (status === 'In Store' || status === 'Only 1 Left') {
    return `On our shelves now — call ${STORE.phone} to hold a copy, or order online through Bookshop.org.`;
  }
  if (status === 'Preorder') {
    return 'Preorder through Bookshop.org — your order still supports our store.';
  }
  return 'Ships faster via Bookshop.org — and still supports our store!';
}
