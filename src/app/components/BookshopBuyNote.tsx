import React from 'react';
import { INVENTORY_STATUS_IS_LIVE } from '@/lib/features';
import { PhoneLink } from '@/app/components/PhoneLink';

/**
 * What to tell someone under a Bookshop.org button.
 *
 * With no trustworthy stock figures, every title gets the same offer: order
 * online, or ring the shop and let a person look. That is useful whatever the
 * shelf actually holds, and it never promises a copy that isn't there. Once
 * the inventory is live, a title on our shelves shouldn't be described as
 * shipping from a warehouse.
 */
export const BookshopBuyNote = ({ status }: { status: string }) => {
  if (!INVENTORY_STATUS_IS_LIVE) {
    return status === 'Preorder' ? (
      <>Preorder through Bookshop.org, or call <PhoneLink /> to reserve a copy with us.</>
    ) : (
      <>Order through Bookshop.org, or call <PhoneLink /> to see if it's on our shelves.</>
    );
  }

  if (status === 'In Store' || status === 'Only 1 Left') {
    return (
      <>On our shelves now — call <PhoneLink /> to hold a copy, or order online through Bookshop.org.</>
    );
  }
  if (status === 'Preorder') {
    return <>Preorder through Bookshop.org — your order still supports our store.</>;
  }
  return <>Ships faster via Bookshop.org — and still supports our store!</>;
};
