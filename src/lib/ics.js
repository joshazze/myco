const pad = (n) => String(n).padStart(2, '0');

function toICSUtc(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeICS(text) {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

function fold(line) {
  if (line.length <= 75) return line;
  const out = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + 75);
    out.push(i === 0 ? chunk : ' ' + chunk);
    i += 75;
  }
  return out.join('\r\n');
}

/**
 * Build a VCALENDAR with VEVENTs. Each event:
 *   { uid, summary, description?, dtstart (ISO/Date), duration? (ms), rrule? { freq, interval, until? (ISO/Date), count? } }
 */
export function buildICS(events) {
  const stamp = toICSUtc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//myco//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const ev of events) {
    const start = new Date(ev.dtstart);
    const durMs = ev.duration ?? 30 * 60_000;
    const end = new Date(start.getTime() + durMs);
    lines.push('BEGIN:VEVENT');
    lines.push(fold(`UID:${ev.uid}`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${toICSUtc(start)}`);
    lines.push(`DTEND:${toICSUtc(end)}`);
    lines.push(fold(`SUMMARY:${escapeICS(ev.summary)}`));
    if (ev.description) lines.push(fold(`DESCRIPTION:${escapeICS(ev.description)}`));
    if (ev.rrule) {
      const parts = [`FREQ=${ev.rrule.freq}`];
      if (ev.rrule.interval) parts.push(`INTERVAL=${ev.rrule.interval}`);
      if (ev.rrule.count) parts.push(`COUNT=${ev.rrule.count}`);
      if (ev.rrule.until) parts.push(`UNTIL=${toICSUtc(ev.rrule.until)}`);
      lines.push(`RRULE:${parts.join(';')}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(filename, ics) {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function icsFilename(prefix = 'myco') {
  const slug = prefix.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'myco';
  const today = new Date().toISOString().slice(0, 10);
  return `${slug}-${today}.ics`;
}

/**
 * For sector + fert type, compute the next due date.
 * Returns: { dtstart, rrule } in ICS-ready format.
 */
export function buildSectorReminderEvent(sector, type, label, lastFertISO) {
  const interval = sector.intervals[type];
  const baseISO = lastFertISO || new Date().toISOString();
  const next = new Date(baseISO);
  next.setUTCDate(next.getUTCDate() + interval);
  // Force time to 09:00 local (use today's time-zone offset, but UTC representation)
  next.setHours(9, 0, 0, 0);
  return {
    uid: `myco-${sector.id}-${type}@joshazze.github.io`,
    summary: `Adubar ${sector.name} (${label})`,
    description: `Setor: ${sector.name}\nTipo: ${label}\nIntervalo: a cada ${interval} dia(s).\nGerado pelo myco.`,
    dtstart: next,
    duration: 30 * 60_000,
    rrule: { freq: 'DAILY', interval },
  };
}
