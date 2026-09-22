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
 * Gift card balances live in the same database, which isn't kept in step
 * with the register yet: a card spent in the shop since February would show
 * its old balance online. Until it is, the Gift Cards page sends people to
 * the store for their balance instead of looking it up.
 *
 * Flip this to true once gift card redemptions sync from the POS.
 */
export const GIFT_CARD_BALANCES_ARE_LIVE = false;

/**
 * True when a title should be bought through Bookshop.org rather than added to
 * the store's own cart. "Available to Order" titles always went this way, since
 * the store doesn't hold them.
 */
export function buysThroughBookshop(status: string) {
  return !STORE_ORDERING_ENABLED || status === 'Available to Order';
}
