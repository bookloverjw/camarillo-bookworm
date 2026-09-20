import React from 'react';
import { STORE } from '@/lib/storeConfig';

/**
 * The store's number as a tap-to-call link. On a phone it dials; on a
 * desktop it hands off to whatever handles tel: links, which is how the
 * footer and About page have always behaved.
 *
 * nowrap matters on mobile: the number is read and tapped as one thing, and
 * a line break after "(805)" splits it into two targets that look unrelated.
 *
 * At body text size the link is about 15px tall, far short of the ~44px a
 * finger needs. Vertical padding on an inline element grows the tap area
 * without moving the line it sits on, so the sentence is untouched. py-3
 * gets it to 39px; going further starts to overlap the link on the next
 * line down and steal its taps.
 */
export const PhoneLink = ({ className = '' }: { className?: string }) => (
  <a
    href={STORE.phoneTel}
    className={`py-3 font-medium underline underline-offset-2 whitespace-nowrap hover:text-primary ${className}`}
  >
    {STORE.phone}
  </a>
);
