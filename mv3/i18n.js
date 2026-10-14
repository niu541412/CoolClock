var ext = globalThis.browser || globalThis.chrome;
function t(key, values) {
  const chosen = globalThis.coolClockLanguage || (typeof localStorage === 'undefined' ? '' : localStorage.getItem('language'));
  const locale = chosen?.replace('-', '_');
  let value = globalThis.COOL_CLOCK_LOCALES?.[locale]?.[key] || ext.i18n.getMessage(key) || key;
  if (values) for (const [name, text] of Object.entries(values)) value = value.replaceAll(`{${name}}`, String(text));
  return value;
}
function translatePage() {
  document.documentElement.lang = localStorage.getItem('language') || ext.i18n.getUILanguage();
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-short]').forEach(node => {
    const value = t(node.dataset.i18nShort);
    node.textContent = /^[\u3400-\u9fff]/.test(value) ? value.slice(-1) : value.slice(0, 3);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-title]').forEach(node => { node.title = t(node.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nAria)); });
}
