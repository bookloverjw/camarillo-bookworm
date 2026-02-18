/**
 * Single source of truth for store info shown across the site.
 * Update here and every page picks it up.
 *
 * For detailed hours logic (is-open checks, holidays), see storeHours.ts.
 */

export const STORE = {
  name: 'Camarillo Bookworm',
  phone: '(805) 482-1384',
  phoneTel: 'tel:+18054821384',
  email: 'hello@camarillobookworm.com',
  address: {
    line1: '93 E Daily Dr',
    city: 'Camarillo',
    state: 'CA',
    zip: '93010',
    full: '93 E Daily Dr, Camarillo, CA 93010',
  },
  hours: {
    'Mon – Fri': '10am – 6pm',
    'Saturday':  '10am – 5pm',
    'Sunday':    '12pm – 5pm',
  },
  /** Quick one-liner for compact contexts (checkout, dashboard). */
  hoursOneLiner: 'Mon-Fri: 10am-6pm | Sat: 10am-5pm | Sun: 12pm-5pm',
  foundedYear: 1973,
  social: {
    instagram: 'https://www.instagram.com/camarillobookworm/',
    facebook: 'https://www.facebook.com/CamarilloBookworm/',
  },
} as const;
