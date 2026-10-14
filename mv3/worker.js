if (typeof importScripts === 'function') importScripts('locale_catalog.js', 'i18n.js');
var ext = globalThis.browser || globalThis.chrome;
const STATE_KEY = 'coolClockState';
const STATS_KEY = 'coolClockUsage';
const PREFIX = 'coolclock:';
const DEFAULT_STATE = {alarms: [], countdowns: [], stopwatch: {elapsed: 0, started: null}, todos: {}, settings: {hour12: true, digital: true, timezoneEnabled: false, timezone: null, keepAwake: true, badge: false, icon: true, badgeStatic: false, badgeColor: '#428bca', clockColor: '#000000', clockDefinition: null, popupVersion: '1', contextMenuEnabled: true, sound: true, ringtone: 'default', ringLoop: false, hourlyEnabled: true, hourlyDuration: 7, hourlyVoice: false, hourlyVoiceText: 'It is %h %P.', hourlySound: 'none', hourlyStyle: 'default', hourlyBgColor: '#0772a1', hourlyManualClose: false, weather: null, timerPresetSaved: false, timerPreset: {seconds: 300, repeat: false, text: '', color: 'primary'}}};
let work = Promise.resolve();
let offscreenOpening;

function enqueue(task) {
  const result = work.then(task);
  work = result.catch(error => console.error('Cool Clock:', error));
  return result;
}

async function ensureOffscreen() {
  if (!ext.offscreen) return;
  if (offscreenOpening) return offscreenOpening;
  offscreenOpening = (async () => {
    const contexts = await ext.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [ext.runtime.getURL('mv3/offscreen.html')]});
    if (!contexts.length) await ext.offscreen.createDocument({url: 'mv3/offscreen.html', reasons: ['LOCAL_STORAGE', 'AUDIO_PLAYBACK', 'CLIPBOARD'], justification: 'Import existing clock data, play alarm sounds, and copy the current time'});
  })();
  try { await offscreenOpening; } finally { offscreenOpening = null; }
}

function parseLegacy(text, fallback) {
  try { return text == null ? fallback : JSON.parse(text); } catch { return fallback; }
}

async function beginSession() {
  const now = Date.now();
  const usage = (await ext.storage.local.get(STATS_KEY))[STATS_KEY] || {enabled: true, history: []};
  if (usage.start && usage.lastSeen >= usage.start) {
    usage.history.push({start: usage.start, end: usage.lastSeen});
    usage.history = usage.history.slice(-1000);
  }
  usage.start = now;
  usage.lastSeen = now;
  await ext.storage.local.set({[STATS_KEY]: usage});
}

async function touchSession() {
  const usage = (await ext.storage.local.get(STATS_KEY))[STATS_KEY];
  if (usage?.enabled && usage.start) {
    usage.lastSeen = Date.now();
    await ext.storage.local.set({[STATS_KEY]: usage});
  }
}

async function state() {
  const saved = (await ext.storage.local.get(STATE_KEY))[STATE_KEY];
  if (saved) {
    if (saved.settings?.language === 'ar') {
      saved.settings.language = 'fa';
      await ext.storage.local.set({[STATE_KEY]: saved});
    }
    globalThis.coolClockLanguage = saved.settings?.language || '';
    return saved;
  }
  await ensureOffscreen();
  const old = ext.offscreen ? await ext.runtime.sendMessage({target: 'offscreen', type: 'read-legacy'}) : readLegacy();
  const migrated = structuredClone(DEFAULT_STATE);
  const oldAlarms = parseLegacy(old.alarm, []);
  migrated.alarms = (Array.isArray(oldAlarms) ? oldAlarms : []).filter(a => a && validTime(+a.hour, 23) && validTime(+a.min, 59)).map(a => ({
    id: String(a.id || crypto.randomUUID()), hour: +a.hour, minute: +a.min,
    days: a.type === 'd' ? [0, 1, 2, 3, 4, 5, 6] :
      (a.type === 's' && Array.isArray(a.day) ? a.day.map(Number).filter(d => validTime(d, 6)) : []),
    message: String(a.message || a.text || ''), enabled: a.off !== true
  }));
  const oldCountdowns = parseLegacy(old.countdown, []);
  migrated.countdowns = (Array.isArray(oldCountdowns) ? oldCountdowns : []).filter(t => t && Number.isFinite(+t.end) && +t.end > Date.now()).map(t => ({
    id: String(t.id || crypto.randomUUID()), end: +t.end, duration: +t.duration || +t.end - Date.now(),
    start: +t.start || +t.end - (+t.duration || +t.end - Date.now()),
    color: t.color || 'primary', repeat: !!t.repeat, message: String(t.message || '')
  }));
  const oldTodos = parseLegacy(old.todo, {});
  migrated.todos = oldTodos && typeof oldTodos === 'object' && !Array.isArray(oldTodos) ? oldTodos : {};
  migrated.settings.hour12 = old.pm == null ? true : old.pm === 'true';
  migrated.settings.timezoneEnabled = old.enabletimezone === 'true';
  migrated.settings.timezone = old.timezone != null && Number.isFinite(Number(old.timezone)) ? Number(old.timezone) : null;
  migrated.settings.keepAwake = old.keepawake !== 'false';
  migrated.settings.digital = old.use_digit !== 'false';
  migrated.settings.sound = old.ringtone !== 'none';
  migrated.settings.ringtone = old.ringtone && old.ringtone !== 'database' ? old.ringtone : 'default';
  migrated.settings.ringLoop = old.ring_loop === 'true';
  migrated.settings.hourlyEnabled = old.shownotification !== 'false';
  migrated.settings.hourlyDuration = Math.max(1, Math.min(3600, Number(old.shownotificationtime) || 7));
  const oldVoice = parseLegacy(old.noti_voice, {});
  migrated.settings.hourlyVoice = oldVoice?.enabled === true;
  migrated.settings.hourlyVoiceText = String(oldVoice?.text || 'It is %h %P.');
  migrated.settings.hourlySound = old.noti_sound || 'none';
  migrated.settings.hourlyStyle = old.noti_style === 'compact' ? 'compact' : 'default';
  migrated.settings.hourlyBgColor = /^#[0-9a-f]{6}$/i.test(old.noti_bgColor || '') ? old.noti_bgColor : '#0772a1';
  migrated.settings.hourlyManualClose = old.manuallyclosenoti === 'true';
  migrated.settings.badge = old.badge === 'true';
  migrated.settings.icon = old.icon !== 'false';
  migrated.settings.badgeStatic = old.show === 'true';
  migrated.settings.badgeColor = old.badge_color || '#428bca';
  migrated.settings.clockColor = old.clockcolor_value || '#000000';
  migrated.settings.clockDefinition = parseLegacy(old.clockDefinition, null);
  migrated.settings.popupVersion = old.popup_version || '1';
  migrated.settings.contextMenuEnabled = old.context_menu_item_enable !== 'false';
  migrated.settings.language = old.language === 'ar' ? 'fa' : (old.language || '');
  globalThis.coolClockLanguage = migrated.settings.language;
  await ext.storage.local.set({[STATE_KEY]: migrated});
  await reconcile(migrated);
  return migrated;
}

async function save(next) {
  await ext.storage.local.set({[STATE_KEY]: next});
  await reconcile(next);
  return next;
}

function clockShift(settings, at = new Date()) {
  return settings.timezoneEnabled && Number.isFinite(settings.timezone) ?
    (settings.timezone + at.getTimezoneOffset() / 60) * 3600000 : 0;
}

function clockNow(settings, at = new Date()) { return new Date(at.getTime() + clockShift(settings, at)); }

function nextAlarmTime(alarm, settings, now = new Date()) {
  if (!alarm.enabled) return null;
  const emulated = clockNow(settings, now);
  for (let offset = 0; offset <= 7; offset++) {
    const date = new Date(emulated.getFullYear(), emulated.getMonth(), emulated.getDate() + offset, alarm.hour, alarm.minute);
    const realTime = date.getTime() - clockShift(settings, date);
    if (realTime <= now.getTime()) continue;
    if (!alarm.days.length || alarm.days.includes(date.getDay())) return realTime;
  }
  return null;
}

async function rebuildContextMenus(settings) {
  await ext.contextMenus.removeAll();
  if (settings.contextMenuEnabled === false) return;
  const action = ['action'];
  const pending = [];
  const create = (id, title, contexts = action, extra = {}) => pending.push(Promise.resolve(ext.contextMenus.create({id, title, contexts, ...extra})));
  create('new-alarm', t('alarm'));
  create('saved-alarms', t('viewsavedalarm'));
  create('open-countdown', t('countdown'));
  create('open-stopwatch', t('timer'));
  create('open-calendar', t('calendar'));
  create('open-voice', 'Voice Control...');
  create('icon-digital', t('digital'), action, {type: 'radio', checked: settings.digital !== false});
  create('icon-analog', t('analog'), action, {type: 'radio', checked: settings.digital === false});
  create('open-options', t('settings'));
  create('open-update', t('whatsnew'));
  create('open-about', t('about'));
  create('hide-menu', t('ctxhide'));
  create('insert-time', 'Get current time...', ['editable']);
  await Promise.all(pending);
}

async function reconcile(data) {
  const expected = new Map();
  for (const alarm of data.alarms) {
    const when = nextAlarmTime(alarm, data.settings);
    if (when) expected.set(PREFIX + 'alarm:' + alarm.id, when);
  }
  for (const timer of data.countdowns) expected.set(PREFIX + 'timer:' + timer.id, Math.max(timer.end, Date.now() + 1000));
  if (data.settings.hourlyEnabled) {
    const now = clockNow(data.settings);
    expected.set(PREFIX + 'hourly', new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1).getTime() - clockShift(data.settings));
  }
  expected.set(PREFIX + 'badge', Date.now() + 60_000);
  const existing = await ext.alarms.getAll();
  for (const entry of existing) {
    if (entry.name.startsWith(PREFIX) && entry.name !== PREFIX + 'hourly-clear' && !expected.has(entry.name)) await ext.alarms.clear(entry.name);
  }
  for (const [name, when] of expected) {
    const current = existing.find(entry => entry.name === name);
    if (!current || Math.abs(current.scheduledTime - when) > 1000) await ext.alarms.create(name, {when});
  }
  if (ext.power) {
    if (data.settings.keepAwake !== false && (data.alarms.some(alarm => alarm.enabled) || data.countdowns.length)) ext.power.requestKeepAwake('system');
    else ext.power.releaseKeepAwake();
  }
  await updateBadge(data);
}

async function updateBadge(data) {
  const now = clockNow(data.settings);
  const settings = data.settings;
  const hour = settings.hour12 ? (now.getHours() % 12 || 12) : now.getHours();
  const badgeText = !settings.digital && settings.badge ?
    (settings.badgeStatic ? (now.getMinutes() < 30 ? `${String(now.getHours()).padStart(2, '0')}:` : `:${String(now.getMinutes()).padStart(2, '0')}`) : `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`) : '';
  await ext.action.setBadgeText({text: badgeText});
  await ext.action.setBadgeBackgroundColor({color: settings.badgeColor || '#428bca'});
  await ext.action.setTitle({title: now.toLocaleString()});
  const canvas = globalThis.OffscreenCanvas ? new OffscreenCanvas(32, 32) : document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!settings.digital && !settings.icon) {
    await ext.action.setIcon({imageData: context.getImageData(0, 0, 32, 32)});
    return;
  }
  const definition = (settings.clockDefinition || {})[settings.digital ? 'digital' : 'analog'] || {};
  if (settings.digital) {
    context.fillStyle = settings.clockColor || '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `bold ${Math.max(8, Math.min(30, Number(definition.hrFontSize) || 18))}px sans-serif`;
    context.fillText(String(hour).padStart(2, '0'), 16, 10, 32);
    context.font = `bold ${Math.max(8, Math.min(30, Number(definition.minFontSize) || 18))}px sans-serif`;
    context.fillText(String(now.getMinutes()).padStart(2, '0'), 16, 25, 32);
  } else {
    const center = 16;
    const radius = 14;
    if (definition.clockBg && definition.clockBg !== 'transparent') {
      context.fillStyle = definition.clockBg;
      context.beginPath(); context.arc(center, center, radius, 0, Math.PI * 2); context.fill();
    }
    if (definition.indicationLines !== false) {
      context.strokeStyle = definition.circleBorderColor || '#6E6E6E';
      context.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        context.beginPath();
        context.moveTo(center + Math.sin(angle) * 12, center - Math.cos(angle) * 12);
        context.lineTo(center + Math.sin(angle) * 14, center - Math.cos(angle) * 14);
        context.stroke();
      }
    }
    if (definition.circleBorder) {
      context.strokeStyle = definition.circleBorderColor || '#6E6E6E';
      context.lineWidth = Number(definition.circleBorderWidth) || 1;
      context.beginPath(); context.arc(center, center, radius, 0, Math.PI * 2); context.stroke();
    }
    const hand = (angle, length, width, color) => {
      context.lineWidth = width; context.lineCap = definition.flatTip ? 'butt' : 'round'; context.strokeStyle = color;
      context.beginPath(); context.moveTo(center, center);
      context.lineTo(center + Math.sin(angle) * length, center - Math.cos(angle) * length);
      context.stroke();
    };
    const width = Math.max(1, (Number(definition.strokeWidth) || 5) * 0.6);
    hand((now.getHours() % 12 + now.getMinutes() / 60) * Math.PI / 6, 8, width, definition.hrColor || '#808080');
    hand(now.getMinutes() * Math.PI / 30, 12, width * 0.7, definition.minColor || '#A7A7A7');
  }
  await ext.action.setIcon({imageData: context.getImageData(0, 0, 32, 32)});
}

async function notify(kind, entry) {
  const id = PREFIX + kind + ':' + entry.id;
  const title = entry.message || t(kind === 'alarm' ? 'alarm' : 'countdown');
  const message = entry.message ? t(kind === 'alarm' ? 'alarmRinging' : 'timesUp') :
    (kind === 'alarm' ? t('scheduledFor',{time:`${String(entry.hour).padStart(2, '0')}:${String(entry.minute).padStart(2, '0')}`}) : t('timesUp'));
  const options = {type: 'basic', iconUrl: ext.runtime.getURL('n_icon.png'), title, message};
  if (ext.notifications.onButtonClicked) {
    options.requireInteraction = true;
    options.buttons = [{title: t('dismissLabel')}];
  }
  await ext.notifications.create(id, options);
  const data = await state();
  if (data.settings.sound) {
    await ensureOffscreen();
    const url = data.settings.ringtone === 'default' ? ext.runtime.getURL('sounds/alarm.mp3') : data.settings.ringtone;
    if (ext.offscreen) await ext.runtime.sendMessage({target: 'offscreen', type: 'play', url, repeat: !!data.settings.ringLoop});
    else await playAudio(url, !!data.settings.ringLoop);
  }
}

async function notifyHourly(data) {
  const now = clockNow(data.settings);
  const id = PREFIX + 'hourly-notification';
  const title = t('hourlytimeannounce');
  const message = now.toLocaleString(ext.i18n.getUILanguage(), {weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: data.settings.hour12});
  const options = {type: 'basic', iconUrl: ext.runtime.getURL('n_icon.png'), title, message};
  if (ext.offscreen) {
    if (data.settings.hourlyStyle === 'compact') {
      options.type = 'list';
      options.items = [{title: now.toLocaleTimeString(globalThis.coolClockLanguage || undefined, {hour: 'numeric', minute: '2-digit'}), message}];
    } else {
      await ensureOffscreen();
      const imageUrl = await ext.runtime.sendMessage({target: 'offscreen', type: 'render-hourly',
        color: data.settings.hourlyBgColor || '#0772a1',
        time: now.toLocaleTimeString(globalThis.coolClockLanguage || undefined, {hour: 'numeric', minute: '2-digit'}),
        date: now.toLocaleDateString(globalThis.coolClockLanguage || undefined, {weekday: 'long', month: 'long', day: 'numeric'})});
      if (typeof imageUrl === 'string' && imageUrl.startsWith('data:image/')) {
        options.type = 'image';
        options.imageUrl = imageUrl;
      }
    }
  }
  try { await ext.notifications.create(id, options); }
  catch (error) {
    console.warn('Cool Clock hourly notification style:', error);
    await ext.notifications.create(id, {type: 'basic', iconUrl: ext.runtime.getURL('n_icon.png'), title, message});
  }
  const seconds = Number(data.settings.hourlyDuration) || 7;
  if (!data.settings.hourlyManualClose) await ext.alarms.create(PREFIX + 'hourly-clear', {when: Date.now() + seconds * 1000});
  if (data.settings.hourlySound && data.settings.hourlySound !== 'none') {
    await ensureOffscreen();
    if (ext.offscreen) await ext.runtime.sendMessage({target: 'offscreen', type: 'play', url: data.settings.hourlySound});
    else await playAudio(data.settings.hourlySound);
  }
  if (data.settings.hourlyVoice) {
    const text = String(data.settings.hourlyVoiceText || 'It is %h %P.').replace(/%([HhPM])/g, (_match, key) => ({
      H: String(now.getHours()), h: String(now.getHours() % 12 || 12),
      P: t(now.getHours() < 12 ? 'am' : 'pm'), M: String(now.getMinutes())
    })[key]);
    if (ext.tts?.speak) await ext.tts.speak(text);
    else {
      await ensureOffscreen();
      if (ext.offscreen) await ext.runtime.sendMessage({target: 'offscreen', type: 'speak', text});
      else speakText(text);
    }
  }
}

async function handleAlarm(event) {
  if (event.name === PREFIX + 'badge') { await touchSession(); await reconcile(await state()); return; }
  if (event.name === PREFIX + 'hourly-clear') { await ext.notifications.clear(PREFIX + 'hourly-notification'); stopSound(); return; }
  const data = await state();
  if (event.name === PREFIX + 'hourly') {
    if (data.settings.hourlyEnabled) await notifyHourly(data);
    await reconcile(data);
    return;
  }
  if (event.name.startsWith(PREFIX + 'alarm:')) {
    const entry = data.alarms.find(a => PREFIX + 'alarm:' + a.id === event.name);
    if (!entry || !entry.enabled) return;
    // A recurring alarm keeps its selected weekdays; a one-shot alarm switches off.
    if (!entry.days.length) entry.enabled = false;
    await save(data);
    await notify('alarm', entry);
  } else if (event.name.startsWith(PREFIX + 'timer:')) {
    const index = data.countdowns.findIndex(t => PREFIX + 'timer:' + t.id === event.name);
    if (index < 0) return;
    const entry = data.countdowns[index];
    if (entry.repeat && entry.duration > 0) {
      entry.start = Date.now();
      entry.end = Date.now() + entry.duration;
    } else {
      data.countdowns.splice(index, 1);
    }
    await save(data);
    await notify('timer', entry);
  }
}

function validTime(value, max) { return Number.isInteger(value) && value >= 0 && value <= max; }

async function handleMessage(message) {
  const data = await state();
  switch (message.type) {
    case 'get': return data;
    case 'test-hourly': await notifyHourly(data); return data;
    case 'get-stats': {
      const usage = (await ext.storage.local.get(STATS_KEY))[STATS_KEY] || {enabled: true, history: []};
      return {...usage, history: [...usage.history, ...(usage.start && usage.enabled ? [{start: usage.start, end: Date.now()}] : [])]};
    }
    case 'clear-stats': {
      const usage = {enabled: true, history: [], start: Date.now(), lastSeen: Date.now()};
      await ext.storage.local.set({[STATS_KEY]: usage});
      return usage;
    }
    case 'set-stats-enabled': {
      const usage = (await ext.storage.local.get(STATS_KEY))[STATS_KEY] || {enabled: true, history: []};
      usage.enabled = !!message.enabled;
      if (usage.enabled) usage.start = usage.lastSeen = Date.now();
      else { usage.start = null; usage.lastSeen = null; }
      await ext.storage.local.set({[STATS_KEY]: usage});
      return usage;
    }
    case 'add-alarm': {
      const {hour, minute, days, text} = message;
      if (!validTime(hour, 23) || !validTime(minute, 59) || !Array.isArray(days) || days.some(d => !validTime(d, 6))) throw Error('Invalid alarm time or weekdays');
      data.alarms.push({id: typeof message.id === 'string' ? message.id : crypto.randomUUID(), hour, minute, days: [...new Set(days)], message: String(text || '').slice(0, 200), enabled: true});
      return save(data);
    }
    case 'update-alarm': {
      const entry = data.alarms.find(a => a.id === message.id);
      if (!entry) return data;
      if (message.hour !== undefined) { if (!validTime(message.hour, 23)) throw Error('Invalid hour'); entry.hour = message.hour; }
      if (message.minute !== undefined) { if (!validTime(message.minute, 59)) throw Error('Invalid minute'); entry.minute = message.minute; }
      if (message.days !== undefined) { if (!Array.isArray(message.days) || message.days.some(d => !validTime(d, 6))) throw Error('Invalid weekdays'); entry.days = [...new Set(message.days)]; }
      if (message.text !== undefined) entry.message = String(message.text).slice(0, 200);
      if (typeof message.enabled === 'boolean') entry.enabled = message.enabled;
      return save(data);
    }
    case 'toggle-alarm': {
      const entry = data.alarms.find(a => a.id === message.id);
      if (entry) { entry.enabled = !entry.enabled; return save(data); }
      return data;
    }
    case 'remove-alarm': data.alarms = data.alarms.filter(a => a.id !== message.id); return save(data);
    case 'remove-all-alarms': data.alarms = []; return save(data);
    case 'add-timer': {
      const seconds = Number(message.seconds);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 31536000) throw Error('Invalid countdown duration');
      const timer = {id: typeof message.id === 'string' ? message.id : crypto.randomUUID(), end: Date.now() + seconds * 1000, duration: seconds * 1000, start: Date.now(), color: ['primary', 'success', 'warning'].includes(message.color) ? message.color : 'primary', repeat: !!message.repeat, message: String(message.text || '').slice(0, 200)};
      data.countdowns.push(timer);
      data.settings.timerPreset = {seconds, repeat: timer.repeat, text: timer.message, color: timer.color};
      data.settings.timerPresetSaved = true;
      return save(data);
    }
    case 'remove-timer': data.countdowns = data.countdowns.filter(t => t.id !== message.id); return save(data);
    case 'update-timer': {
      const timer = data.countdowns.find(t => t.id === message.id);
      if (!timer) return data;
      if (typeof message.repeat === 'boolean') timer.repeat = message.repeat;
      if (['primary', 'success', 'warning'].includes(message.color)) timer.color = message.color;
      return save(data);
    }
    case 'remove-all-timers': data.countdowns = []; return save(data);
    case 'stopwatch': {
      const sw = data.stopwatch;
      if (message.action === 'start' && sw.started == null) sw.started = Date.now();
      if (message.action === 'pause' && sw.started != null) { sw.elapsed += Date.now() - sw.started; sw.started = null; }
      if (message.action === 'reset') { sw.elapsed = 0; sw.started = null; }
      return save(data);
    }
    case 'settings': {
      if (typeof message.hour12 === 'boolean') data.settings.hour12 = message.hour12;
      if (typeof message.timezoneEnabled === 'boolean') data.settings.timezoneEnabled = message.timezoneEnabled;
      if (typeof message.timezone === 'number' && Number.isFinite(message.timezone) && message.timezone >= -12 && message.timezone <= 14) data.settings.timezone = message.timezone;
      if (typeof message.keepAwake === 'boolean') data.settings.keepAwake = message.keepAwake;
      if (typeof message.sound === 'boolean') data.settings.sound = message.sound;
      if (typeof message.ringtone === 'string' && message.ringtone.length <= 10_000_000) {
        data.settings.ringtone = message.ringtone;
        data.settings.sound = message.ringtone !== 'none';
      }
      if (typeof message.ringLoop === 'boolean') data.settings.ringLoop = message.ringLoop;
      if (typeof message.hourlyEnabled === 'boolean') data.settings.hourlyEnabled = message.hourlyEnabled;
      if (Number.isFinite(message.hourlyDuration)) data.settings.hourlyDuration = Math.max(1, Math.min(3600, message.hourlyDuration));
      if (typeof message.hourlyVoice === 'boolean') data.settings.hourlyVoice = message.hourlyVoice;
      if (typeof message.hourlyVoiceText === 'string') data.settings.hourlyVoiceText = message.hourlyVoiceText.slice(0, 500);
      if (typeof message.hourlySound === 'string') data.settings.hourlySound = message.hourlySound.slice(0, 10_000_000);
      if (message.hourlyStyle === 'default' || message.hourlyStyle === 'compact') data.settings.hourlyStyle = message.hourlyStyle;
      if (typeof message.hourlyBgColor === 'string' && /^#[0-9a-f]{6}$/i.test(message.hourlyBgColor)) data.settings.hourlyBgColor = message.hourlyBgColor;
      if (typeof message.hourlyManualClose === 'boolean') data.settings.hourlyManualClose = message.hourlyManualClose;
      if (typeof message.digital === 'boolean') data.settings.digital = message.digital;
      if (typeof message.badge === 'boolean') data.settings.badge = message.badge;
      if (typeof message.icon === 'boolean') data.settings.icon = message.icon;
      if (typeof message.badgeStatic === 'boolean') data.settings.badgeStatic = message.badgeStatic;
      if (typeof message.badgeColor === 'string' && /^#[0-9a-f]{6}$/i.test(message.badgeColor)) data.settings.badgeColor = message.badgeColor;
      if (typeof message.clockColor === 'string' && /^#[0-9a-f]{6}$/i.test(message.clockColor)) data.settings.clockColor = message.clockColor;
      if (message.clockDefinition && typeof message.clockDefinition === 'object') data.settings.clockDefinition = message.clockDefinition;
      if (message.popupVersion === '1' || message.popupVersion === '0') {
        data.settings.popupVersion = message.popupVersion;
        await ext.action.setPopup({popup: message.popupVersion === '1' ? 'new_popup2.html' : 'popup.html'});
      }
      if (typeof message.language === 'string') {
        data.settings.language = message.language;
        globalThis.coolClockLanguage = message.language;
      }
      if (typeof message.contextMenuEnabled === 'boolean') {
        data.settings.contextMenuEnabled = message.contextMenuEnabled;
        await rebuildContextMenus(data.settings);
      }
      if (message.weather === null || (message.weather && Number.isFinite(message.weather.latitude) && Number.isFinite(message.weather.longitude))) data.settings.weather = message.weather;
      return save(data);
    }
    case 'set-todo': {
      if (!/^\d{8}$/.test(message.date)) throw Error('Invalid date');
      const text = String(message.text || '').trim().slice(0, 500);
      if (text) data.todos[message.date] = [{text}]; else delete data.todos[message.date];
      return save(data);
    }
    case 'replace-todos': {
      if (!message.todos || typeof message.todos !== 'object' || Array.isArray(message.todos)) throw Error('Invalid calendar data');
      data.todos = message.todos;
      return save(data);
    }
    case 'append-todo': {
      if (!/^\d{8}$/.test(message.date)) throw Error('Invalid date');
      const text = String(message.text || '').trim().slice(0, 500);
      if (!text) throw Error('Empty todo');
      const year = Number(message.date.slice(0, 4));
      const month = Number(message.date.slice(4, 6));
      const day = Number(message.date.slice(6, 8));
      const parsed = new Date(year, month - 1, day);
      if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) throw Error('Invalid date');
      (data.todos[message.date] ||= []).push({text, id: Date.now()});
      return save(data);
    }
    default: throw Error('Unknown action');
  }
}

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target !== 'worker') return;
  enqueue(() => handleMessage(message)).then(data => sendResponse({ok: true, data}), error => sendResponse({ok: false, error: error.message}));
  return true;
});
ext.alarms.onAlarm.addListener(event => { enqueue(() => handleAlarm(event)); });
function stopSound() {
  if (ext.offscreen) ext.runtime.sendMessage({target: 'offscreen', type: 'stop'}).catch(() => {});
  else stopAudio();
}
if (ext.notifications.onButtonClicked) ext.notifications.onButtonClicked.addListener(id => {
  if (id.startsWith(PREFIX)) { ext.notifications.clear(id); stopSound(); }
});
ext.notifications.onClosed.addListener(id => {
  if (id.startsWith(PREFIX)) stopSound();
});
ext.notifications.onClicked.addListener(id => {
  if (id.startsWith(PREFIX)) ext.tabs.create({url: ext.runtime.getURL('new_popup2.html')});
});
ext.runtime.onInstalled.addListener(() => { enqueue(async () => { const data = await state(); await beginSession(); await rebuildContextMenus(data.settings); await ext.action.setPopup({popup: data.settings.popupVersion === '0' ? 'popup.html' : 'new_popup2.html'}); }); });
ext.runtime.onStartup.addListener(() => { enqueue(async () => { await beginSession(); await reconcile(await state()); }); });
ext.contextMenus.onClicked.addListener((info, tab) => {
  enqueue(async () => {
    const openTab = path => ext.tabs.create({url: ext.runtime.getURL(path)});
    const openWindow = (path, width, height) => ext.windows.create({url: ext.runtime.getURL(path), type: 'popup', width, height});
    switch (info.menuItemId) {
      case 'new-alarm': case 'saved-alarms': await openWindow('alarm_interface.html', 785, 490); break;
      case 'open-countdown': await openWindow('countdown_interface.html', 700, 450); break;
      case 'open-stopwatch': await openWindow('timer.html', 500, 200); break;
      case 'open-calendar': await openTab('calendar_full.html'); break;
      case 'open-voice': await openWindow('speech.html', 640, 700); break;
      case 'icon-digital': await handleMessage({type: 'settings', digital: true}); break;
      case 'icon-analog': await handleMessage({type: 'settings', digital: false}); break;
      case 'open-options': await ext.runtime.openOptionsPage(); break;
      case 'open-update': await openTab('update.html'); break;
      case 'open-about': await openTab('about.html'); break;
      case 'hide-menu': await handleMessage({type: 'settings', contextMenuEnabled: false}); break;
      case 'insert-time': {
        const value = clockNow((await state()).settings).toLocaleString(globalThis.coolClockLanguage || undefined);
        let inserted = false;
        if (tab?.id != null && ext.scripting) {
          try {
            const results = await ext.scripting.executeScript({target: {tabId: tab.id}, func: text => {
              const active = document.activeElement;
              if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
                const start = active.selectionStart ?? active.value.length;
                const end = active.selectionEnd ?? start;
                active.setRangeText(text, start, end, 'end');
                active.dispatchEvent(new Event('input', {bubbles: true}));
                return true;
              }
              if (active?.isContentEditable) return document.execCommand('insertText', false, text);
              return false;
            }, args: [value]});
            inserted = results?.[0]?.result === true;
          } catch (error) { console.warn('Cool Clock insert time:', error); }
        }
        if (!inserted) {
          await ensureOffscreen();
          if (ext.offscreen) await ext.runtime.sendMessage({target: 'offscreen', type: 'copy', text: value});
          else await navigator.clipboard.writeText(value);
        }
        break;
      }
    }
  });
});

if (ext.omnibox) {
  const xml = value => String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'})[character]);
  const defaultSuggestion = () => ext.omnibox.setDefaultSuggestion({description: 'Enter command (search, add, about)'});
  ext.omnibox.onInputStarted.addListener(defaultSuggestion);
  ext.omnibox.onInputChanged.addListener((query, suggest) => {
    const [command, ...rest] = query.trim().split(/\s+/);
    const value = rest.join(' ');
    if (command === 'search' && value) {
      enqueue(async () => {
        const data = await state();
        const found = [];
        for (const [date, entries] of Object.entries(data.todos)) {
          for (const entry of entries) if (String(entry.text).toLocaleLowerCase().includes(value.toLocaleLowerCase())) {
            found.push({content: `search todo ${date}`, description: `<dim>Todo: </dim>${xml(entry.text)} <dim>- ${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}</dim>`});
          }
        }
        for (const alarm of data.alarms) if (alarm.message.toLocaleLowerCase().includes(value.toLocaleLowerCase())) {
          found.push({content: `search alarm ${alarm.id}`, description: `<dim>Alarm clock: </dim>${xml(alarm.message)} <dim>- ${String(alarm.hour).padStart(2, '0')}:${String(alarm.minute).padStart(2, '0')}</dim>`});
        }
        suggest(found.slice(0, 6));
        ext.omnibox.setDefaultSuggestion({description: `Searching for todos and alarms containing "${xml(value)}" (${found.length} results)`});
      });
    } else if (command === 'add') ext.omnibox.setDefaultSuggestion({description: 'To add a todo, type "add YYYY-MM-DD content" then press Enter'});
    else if (command === 'about') ext.omnibox.setDefaultSuggestion({description: 'About Cool Clock...'});
    else defaultSuggestion();
  });
  ext.omnibox.onInputEntered.addListener(query => {
    enqueue(async () => {
      if (query.startsWith('about')) await ext.tabs.create({url: ext.runtime.getURL('about.html')});
      else if (query.startsWith('search alarm')) await ext.windows.create({url: ext.runtime.getURL('alarm_interface.html'), type: 'popup', width: 785, height: 490});
      else if (query.startsWith('search')) await ext.tabs.create({url: ext.runtime.getURL('calendar_full.html')});
      else {
        const match = query.match(/^add\s+(\d{4})-(\d{2})-(\d{2})\s+(.+)$/i);
        if (!match) return;
        const date = match[1] + match[2] + match[3];
        await handleMessage({type: 'append-todo', date, text: match[4]});
        await ext.notifications.create(PREFIX + 'added-todo:' + Date.now(), {type: 'basic', iconUrl: ext.runtime.getURL('n_icon.png'), title: `Added todo on ${match[1]}-${match[2]}-${match[3]}`, message: match[4]});
      }
    });
  });
  defaultSuggestion();
}
