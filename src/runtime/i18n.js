var ext = globalThis.browser || globalThis.chrome;
if (typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'ar') {
  localStorage.setItem('language', 'fa');
}
function t(key, values) {
  const chosen = globalThis.coolClockLanguage || (typeof localStorage === 'undefined' ? '' : localStorage.getItem('language'));
  const locale = chosen === 'ar' ? 'fa' : chosen?.replace('-', '_');
  let value = globalThis.COOL_CLOCK_LOCALES?.[locale]?.[key] || ext.i18n.getMessage(key) || key;
  if (values) for (const [name, text] of Object.entries(values)) value = value.replaceAll(`{${name}}`, String(text));
  return value;
}
