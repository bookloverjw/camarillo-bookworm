// Store hours configuration for Camarillo Bookworm

export interface StoreHours {
  day: string;
  open: string;
  close: string;
  isClosed?: boolean;
}

// Regular store hours
export const REGULAR_HOURS: Record<number, StoreHours> = {
  0: { day: 'Sunday', open: '12:00', close: '17:00' },    // 12-5
  1: { day: 'Monday', open: '10:00', close: '18:00' },    // 10-6
  2: { day: 'Tuesday', open: '10:00', close: '18:00' },   // 10-6
  3: { day: 'Wednesday', open: '10:00', close: '18:00' }, // 10-6
  4: { day: 'Thursday', open: '10:00', close: '18:00' },  // 10-6
  5: { day: 'Friday', open: '10:00', close: '18:00' },    // 10-6
  6: { day: 'Saturday', open: '10:00', close: '17:00' },  // 10-5
};

// Holiday closures (month is 0-indexed)
export const HOLIDAY_CLOSURES = [
  { name: "New Year's Day", month: 0, day: 1 },
  { name: 'Easter', month: -1, day: -1, isEaster: true }, // Calculated dynamically
  { name: 'Thanksgiving', month: -1, day: -1, isThanksgiving: true }, // 4th Thursday of November
  { name: 'Christmas Day', month: 11, day: 25 },
  { name: 'Boxing Day', month: 11, day: 26 },
];

// Calculate Easter date (Western Christian)
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

// Calculate Thanksgiving (4th Thursday of November)
function getThanksgivingDate(year: number): Date {
  const november = new Date(year, 10, 1);
  let thursdayCount = 0;
  for (let day = 1; day <= 30; day++) {
    const date = new Date(year, 10, day);
    if (date.getDay() === 4) {
      thursdayCount++;
      if (thursdayCount === 4) {
        return date;
      }
    }
  }
  return new Date(year, 10, 28); // Fallback
}

// Check if a date is a holiday closure
export function isHolidayClosure(date: Date): { isClosed: boolean; holidayName?: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  for (const holiday of HOLIDAY_CLOSURES) {
    if (holiday.isEaster) {
      const easter = getEasterDate(year);
      if (easter.getMonth() === month && easter.getDate() === day) {
        return { isClosed: true, holidayName: holiday.name };
      }
    } else if (holiday.isThanksgiving) {
      const thanksgiving = getThanksgivingDate(year);
      if (thanksgiving.getMonth() === month && thanksgiving.getDate() === day) {
        return { isClosed: true, holidayName: holiday.name };
      }
    } else if (holiday.month === month && holiday.day === day) {
      return { isClosed: true, holidayName: holiday.name };
    }
  }

  return { isClosed: false };
}

// Format time from 24hr to 12hr
function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const hours12 = hours % 12 || 12;
  return minutes === 0 ? `${hours12}${period}` : `${hours12}:${minutes.toString().padStart(2, '0')}${period}`;
}

// Get today's hours
export function getTodayHours(): { isOpen: boolean; hours: string; holidayName?: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Check for holiday closure
  const holidayCheck = isHolidayClosure(now);
  if (holidayCheck.isClosed) {
    return { isOpen: false, hours: `Closed for ${holidayCheck.holidayName}`, holidayName: holidayCheck.holidayName };
  }

  const todayHours = REGULAR_HOURS[dayOfWeek];
  const openTime = formatTime(todayHours.open);
  const closeTime = formatTime(todayHours.close);

  // Check if currently open
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinutes;

  const [openHour, openMin] = todayHours.open.split(':').map(Number);
  const [closeHour, closeMin] = todayHours.close.split(':').map(Number);
  const openTimeMinutes = openHour * 60 + openMin;
  const closeTimeMinutes = closeHour * 60 + closeMin;

  const isCurrentlyOpen = currentTimeMinutes >= openTimeMinutes && currentTimeMinutes < closeTimeMinutes;

  return {
    isOpen: isCurrentlyOpen,
    hours: `${openTime} - ${closeTime}`,
  };
}

// Get formatted hours for display
export function getFormattedHours(): { weekday: string; saturday: string; sunday: string } {
  return {
    weekday: 'Mon-Fri: 10am - 6pm',
    saturday: 'Sat: 10am - 5pm',
    sunday: 'Sun: 12pm - 5pm',
  };
}

// Get all holiday closure dates for the current year
export function getHolidayClosures(): Array<{ name: string; date: Date }> {
  const year = new Date().getFullYear();
  const closures: Array<{ name: string; date: Date }> = [];

  for (const holiday of HOLIDAY_CLOSURES) {
    if (holiday.isEaster) {
      closures.push({ name: holiday.name, date: getEasterDate(year) });
    } else if (holiday.isThanksgiving) {
      closures.push({ name: holiday.name, date: getThanksgivingDate(year) });
    } else {
      closures.push({ name: holiday.name, date: new Date(year, holiday.month, holiday.day) });
    }
  }

  return closures.sort((a, b) => a.date.getTime() - b.date.getTime());
}
