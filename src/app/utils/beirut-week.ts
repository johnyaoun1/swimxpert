import { addDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { formatInTimeZone, toDate } from 'date-fns-tz';

export const BEIRUT_TZ = 'Asia/Beirut';

/**
 * Walk backward from `anchor` to the calendar Sunday (English weekday name) in Asia/Beirut.
 * Does not use `startOfWeek` on a Date — that follows the *browser* timezone and breaks Beirut week boundaries.
 */
function beirutSundayInstantContaining(anchor: Date): Date {
  let cursor = anchor;
  for (let i = 0; i < 8; i++) {
    if (formatInTimeZone(cursor, BEIRUT_TZ, 'EEEE', { locale: enUS }) === 'Sunday') {
      return cursor;
    }
    cursor = addDays(cursor, -1);
  }
  return anchor;
}

/** Sunday 00:00 – Saturday 23:59:59.999 Asia/Beirut as UTC ISO strings for API range queries. */
export function getBeirutWeekIntervalIso(anchor: Date): { fromIso: string; toIso: string } {
  const sunday = beirutSundayInstantContaining(anchor);
  const sunYmd = formatInTimeZone(sunday, BEIRUT_TZ, 'yyyy-MM-dd');
  const satYmd = formatInTimeZone(addDays(sunday, 6), BEIRUT_TZ, 'yyyy-MM-dd');
  const startUtc = toDate(`${sunYmd}T00:00:00`, { timeZone: BEIRUT_TZ });
  const endUtc = toDate(`${satYmd}T23:59:59.999`, { timeZone: BEIRUT_TZ });
  return { fromIso: startUtc.toISOString(), toIso: endUtc.toISOString() };
}

/** Label like "Apr 19 – Apr 25, 2026" in Beirut. */
export function formatBeirutWeekRangeLabel(anchor: Date): string {
  const sunday = beirutSundayInstantContaining(anchor);
  const end = addDays(sunday, 6);
  const a = formatInTimeZone(sunday, BEIRUT_TZ, 'MMM d');
  const b = formatInTimeZone(end, BEIRUT_TZ, 'MMM d, yyyy');
  return `${a} – ${b}`;
}

/** Column headers: Sun–Sat with dates in Beirut for the week of `anchor`. */
export function getBeirutWeekDayHeaders(anchor: Date): { dow: string; label: string; ymd: string }[] {
  const sunday = beirutSundayInstantContaining(anchor);
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out: { dow: string; label: string; ymd: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(sunday, i);
    out.push({
      dow: names[i],
      label: formatInTimeZone(d, BEIRUT_TZ, 'MMM d'),
      ymd: formatInTimeZone(d, BEIRUT_TZ, 'yyyy-MM-dd')
    });
  }
  return out;
}
