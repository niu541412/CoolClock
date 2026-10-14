// Import iCalendar data into the original calendar without the retired Google XML feed.
const calendarApi = globalThis.browser || globalThis.chrome;

function parseCalendar(text, source) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const events = [];
  for (const block of unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)) {
    const fields = {};
    for (const line of block[1].split(/\r?\n/)) {
      const match = line.match(/^([A-Z]+)(?:;[^:]*)?:(.*)$/);
      if (match) fields[match[1]] = match[2];
    }
    const start = fields.DTSTART?.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!start || !fields.SUMMARY) continue;
    const key = start[1] + start[2] + start[3];
    const summary = fields.SUMMARY.replace(/\\[nN]/g, ' ').replace(/\\([,;\\])/g, '$1').trim();
    if (!summary) continue;
    events.push({date: key, text: summary.slice(0, 500), source});
  }
  return events;
}

async function importCalendar(text, source) {
  const entries = parseCalendar(text, source);
  if (!entries.length) throw Error('No calendar events found in this iCal file.');
  const response = await calendarApi.runtime.sendMessage({target: 'worker', type: 'get'});
  if (!response?.ok) throw Error(response?.error || 'Unable to load calendar');
  const todos = response.data.todos;
  let added = 0;
  for (const entry of entries) {
    const list = todos[entry.date] ||= [];
    if (list.some(item => item.text === entry.text && item.importFrom === source)) continue;
    list.push({text: entry.text, id: Date.now() + added, importFrom: source});
    added++;
  }
  const saved = await calendarApi.runtime.sendMessage({target: 'worker', type: 'replace-todos', todos});
  if (!saved?.ok) throw Error(saved?.error || 'Unable to save calendar');
  localStorage.todo = JSON.stringify(todos);
  alert(`Imported ${added} calendar events.`);
  location.reload();
}

document.getElementById('importCalendar').addEventListener('click', async () => {
  const input = document.querySelector('#options input[placeholder]');
  const value = input.value.trim();
  let url;
  if (value.startsWith('https://')) {
    url = new URL(value);
    if (url.hostname !== 'calendar.google.com' || !url.pathname.endsWith('.ics')) { alert('Use a Google Calendar iCal URL.'); return; }
  } else if (/^[^\s@]+@[^\s@]+$/.test(value)) {
    url = new URL(`https://calendar.google.com/calendar/ical/${encodeURIComponent(value)}/public/basic.ics`);
  } else { alert('Enter a public calendar email address or iCal URL.'); return; }
  try {
    const response = await fetch(url);
    if (!response.ok) throw Error(`Unable to fetch public calendar (${response.status}). Check that it is public.`);
    await importCalendar(await response.text(), value);
  } catch (error) { alert(error.message); }
});

document.getElementById('importPrivateCalendar').addEventListener('click', () => {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.ics,text/calendar';
  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file) return;
    try { await importCalendar(await file.text(), file.name); }
    catch (error) { alert(error.message); }
  };
  picker.click();
});
