/* Settings page controller. Loaded by mv3/legacy_bridge.js after settings arrive. */
const Components = LegacyBackground.Components;
const $id = id => document.getElementById(id);
const $all = selector => Array.from(document.querySelectorAll(selector));
const notifyChange = element => element.dispatchEvent(new Event('change', {bubbles: true}));

function icon(name) {
  return createBootstrapIcon(name);
}

function modalDialog(options = {}) {
  const settings = Object.assign({
    title: '', content: '', backdrop: true, buttons: [], closeBtn: true,
    closeBtnText: i18n('close'), onClose() {}, onShown() {}
  }, options);
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('data-bs-backdrop', String(settings.backdrop));
  modal.innerHTML = '<div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h4 class="modal-title"></h4></div><div class="modal-body"></div><div class="modal-footer"></div></div></div>';
  modal.querySelector('.modal-title').innerHTML = settings.title;
  const body = modal.querySelector('.modal-body');
  if (typeof settings.content === 'string') body.textContent = settings.content;
  else if (settings.content) body.append(settings.content);
  const footer = modal.querySelector('.modal-footer');
  for (const entry of settings.buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-' + (entry.primary ? 'primary' : 'outline-secondary');
    button.textContent = entry.title;
    button.addEventListener('click', () => entry.onclick.call(modal));
    footer.append(button);
  }
  if (settings.closeBtn) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-secondary';
    button.setAttribute('data-bs-dismiss', 'modal');
    button.textContent = settings.closeBtnText;
    footer.append(button);
  }
  modal.addEventListener('shown.bs.modal', settings.onShown, {once: true});
  modal.addEventListener('hidden.bs.modal', () => {
    modal.remove();
    settings.onClose();
  }, {once: true});
  document.body.append(modal);
  showBootstrapModal(modal);
  return modal;
}

function modalTitle(name, text) {
  const holder = document.createElement('span');
  holder.append(icon(name), ' ' + text);
  return holder.innerHTML;
}

function chooseDropdown(link, fireChange = true) {
  const menu = link.closest('.dropdown-menu');
  menu.querySelectorAll('a').forEach(item => item.classList.toggle('active', item === link));
  const button = menu.previousElementSibling;
  button.textContent = link.textContent;
  button.value = link.getAttribute('value') || link.textContent;
  if (fireChange) notifyChange(button);
}

function setupDropdowns() {
  for (const button of $all('.dropdown-toggle')) {
    const links = Array.from(button.nextElementSibling.querySelectorAll('a'));
    for (const link of links) {
      if (!link.hasAttribute('value')) link.setAttribute('value', link.textContent);
      link.addEventListener('click', event => {
        event.preventDefault();
        chooseDropdown(link);
      });
    }
    const selected = links.find(link => link.hasAttribute('selected')) || links[0];
    if (selected) chooseDropdown(selected, false);
  }
}

function bindOption(config) {
  const option = Object.assign({onChange() {}}, config);
  let target = option.type === 'radio' ?
    $all('input[type="radio"][name="' + option.name + '"]') : [$id(option.id)].filter(Boolean);
  if (!target.length) return;
  let value = localStorage[option.key];
  if (option.json !== undefined) {
    value = JSON.parse(value || '{}')[option.json];
  } else if (option.type === 'boolean') {
    value = value === 'true';
  } else if (option.type === 'number') {
    value = Number(value);
  }
  let targetType = option.type;
  if (option.type === 'custom') {
    if (option.LStoValueRegex) {
      const match = option.LStoValueRegex.find(entry => entry[0].test(value || ''));
      if (match) value = match[1];
    } else {
      const match = option.LStoValue.find(entry => value === entry[0]);
      if (match) value = match[1];
    }
    targetType = typeof value;
  }
  const first = target[0];
  if (targetType === 'radio') {
    target.forEach(element => option.onLoad.call(element));
  } else if (targetType === 'boolean') {
    first.checked = option.invert ? !value : !!value;
  } else if (targetType === 'select') {
    const link = Array.from(first.nextElementSibling.querySelectorAll('a'))
      .find(entry => entry.getAttribute('value') === String(value));
    if (link) chooseDropdown(link, false);
  } else if (targetType === 'static') {
    first.textContent = value || '';
  } else if (targetType === 'number' || targetType === 'string') {
    first.value = value == null ? '' : value;
  }
  if (option.changeAtInit) option.onChange.call(first);
  for (const element of target) {
    element.addEventListener('change', event => {
      let changed;
      if (targetType === 'boolean') changed = element.checked;
      else if (targetType === 'number' || targetType === 'string' || targetType === 'select') changed = element.value;
      if (option.type === 'custom') {
        if (option.LStoValueRegex) {
          option.regexAction.call(element, event);
          return;
        }
        const match = option.LStoValue.find(entry => changed === entry[1]);
        if (match) changed = match[0];
      }
      if (option.key !== undefined) {
        if (option.json !== undefined) {
          const data = JSON.parse(localStorage[option.key] || '{}');
          data[option.json] = changed;
          localStorage[option.key] = JSON.stringify(data);
        } else {
          localStorage[option.key] = changed;
        }
      }
      option.onChange.call(element, event);
      if (option.key !== undefined) syncLegacyOption(option.key);
    });
    if (option.onClick) element.addEventListener('click', option.onClick);
  }
}

function refreshRequirements() {
  for (const element of $all('[data-requires]')) {
    const source = $id(element.dataset.requires);
    if (!source) continue;
    let active = !!source.checked;
    for (let parent = element.parentElement?.closest('[data-requires]'); parent;
      parent = parent.parentElement?.closest('[data-requires]')) {
      active = active && !!$id(parent.dataset.requires)?.checked;
    }
    if (element.matches('input, button')) {
      element.disabled = !active;
    } else {
      element.querySelectorAll('input, button').forEach(child => {
        if (!child.matches('#weather, #weather_search, #weather_woeid')) child.disabled = !active;
      });
    }
  }
  $all('[data-disabled="true"]').forEach(element => { element.disabled = true; });
}

function setupRequirements() {
  const sources = new Set($all('[data-requires]').map(element => $id(element.dataset.requires)).filter(Boolean));
  for (const source of sources) {
    const choices = source.type === 'radio' ?
      $all('input[type="radio"][name="' + source.name + '"]') : [source];
    choices.forEach(element => element.addEventListener('change', refreshRequirements));
  }
  refreshRequirements();
}

function setupDateOrder() {
  const list = $id('dateorder');
  const saved = JSON.parse(localStorage.dateorder || '{"1":"Date","2":"Month","3":"Year"}');
  Array.from(list.children).slice(1).forEach((item, index) => {
    const value = saved[String(index + 1)] || item.dataset.value;
    item.dataset.value = value;
    item.append(' ' + i18n('options' + value));
    item.draggable = true;
  });
  const save = () => {
    const result = {};
    Array.from(list.children).slice(1).forEach((item, index) => {
      result[String(index + 1)] = item.dataset.value;
    });
    localStorage.dateorder = JSON.stringify(result);
  };
  let dragged = null;
  Array.from(list.children).slice(1).forEach(item => {
    item.addEventListener('dragstart', event => {
      dragged = item;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.dataset.value);
    });
    item.addEventListener('dragover', event => {
      if (!dragged || dragged === item) return;
      event.preventDefault();
      const middle = item.getBoundingClientRect().top + item.offsetHeight / 2;
      const before = event.clientY < middle ? item : item.nextSibling;
      if (dragged !== before && dragged.nextSibling !== before) list.insertBefore(dragged, before);
    });
  });
  list.addEventListener('drop', event => { event.preventDefault(); save(); dragged = null; });
  list.addEventListener('dragend', () => { if (dragged) save(); dragged = null; });
}

function setupFileButtons() {
  $all('input[type="file"]').forEach(input => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-secondary btn-sm';
    button.append(icon('folder-open'), ' ' + i18n('optionsChooseFile'));
    input.after(button);
    input.classList.add('hide');
    button.addEventListener('click', () => input.click());
  });
}

function readAudio(input, callback) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  if (!/^audio\/(mpeg|mp3|ogg|wav|x-wav|wave)$/.test(file.type) &&
      !/\.(mp3|ogg|wav)$/i.test(file.name)) {
    modalDialog({title: modalTitle('exclamation-sign', i18n('optionsNotice')), content: i18n('optionsAudioTip')});
    return;
  }
  const modal = modalDialog({title: i18n('optionsProcessing'), content: i18n('optionsPleaseWait'), closeBtn: false});
  const reader = new FileReader();
  reader.onload = () => {
    hideBootstrapModal(modal);
    callback(reader.result);
  };
  reader.onerror = () => {
    hideBootstrapModal(modal);
    modalDialog({title: i18n('optionsNotice'), content: reader.error?.message || i18n('optionsSearchError')});
  };
  reader.readAsDataURL(file);
}

function setupWeather() {
  const weather = JSON.parse(localStorage.weather || '{}');
  $id('weather').checked = !!weather.enabled;
  $id('weather_fahrenheit').checked = weather.unit === 'fahrenheit';
  $id('weather').addEventListener('change', function() {
    const value = JSON.parse(localStorage.weather || '{}');
    value.enabled = this.checked;
    localStorage.weather = JSON.stringify(value);
    syncLegacyOption('weather');
  });
  $id('weather_fahrenheit').addEventListener('change', function() {
    const value = JSON.parse(localStorage.weather || '{}');
    if (!value.enabled) return;
    value.unit = this.checked ? 'fahrenheit' : 'celsius';
    localStorage.weather = JSON.stringify(value);
    syncLegacyOption('weather');
  });
  $id('weather_search').addEventListener('click', event => {
    event.preventDefault();
    const content = document.createElement('div');
    const topbar = document.createElement('div');
    topbar.className = 'input-group';
    const caption = document.createElement('span');
    caption.className = 'input-group-addon';
    caption.textContent = i18n('optionsSearchPlace');
    const search = document.createElement('input');
    search.className = 'form-control';
    const searchButton = document.createElement('button');
    searchButton.type = 'button';
    searchButton.className = 'btn btn-outline-secondary';
    searchButton.append(icon('search'));
    topbar.append(caption, search, searchButton);
    const results = document.createElement('div');
    results.className = 'list-group';
    content.append(topbar, results);
    const modal = modalDialog({
      title: modalTitle('search', i18n('optionsSearchByName')),
      content, closeBtnText: i18n('cancel'), onShown: () => search.focus()
    });
    const showMessage = message => {
      results.replaceChildren();
      const item = document.createElement('div');
      item.className = 'list-group-item';
      item.textContent = message;
      results.append(item);
    };
    async function runSearch() {
      const query = search.value.trim();
      if (!query) return;
      showMessage(i18n('optionsLoading'));
      try {
        const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' +
          encodeURIComponent(query) + '&count=8&language=' +
          encodeURIComponent(navigator.language.slice(0, 2));
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const places = (await response.json()).results || [];
        results.replaceChildren();
        if (!places.length) showMessage(i18n('optionsNoResult'));
        places.forEach(place => {
          const label = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
          const link = document.createElement('a');
          link.href = '#';
          link.className = 'list-group-item';
          link.textContent = label;
          link.addEventListener('click', click => {
            click.preventDefault();
            const selected = {enabled: true, name: label, woeid: String(place.id),
              latitude: place.latitude, longitude: place.longitude,
              unit: $id('weather_fahrenheit').checked ? 'fahrenheit' : 'celsius'};
            localStorage.weather = JSON.stringify(selected);
            $id('weather_woeid').value = selected.woeid;
            $id('weather_name').textContent = label;
            $id('weather').checked = true;
            refreshRequirements();
            syncLegacyOption('weather');
            hideBootstrapModal(modal);
          });
          results.append(link);
        });
      } catch (error) {
        showMessage(i18n('optionsSearchError') + ': ' + error.message);
      }
    }
    searchButton.addEventListener('click', runSearch);
    search.addEventListener('keydown', key => { if (key.key === 'Enter') runSearch(); });
  });
}

function setupAudioPlayer() {
  let audio = null;
  let timer = null;
  const load = $id('ringtone_load');
  const play = $id('ringtone_play');
  const pause = $id('ringtone_pause');
  const stop = $id('ringtone_stop');
  const progress = $id('ringtone_duration');
  const bar = progress.parentElement;
  const reset = () => {
    clearInterval(timer);
    play.disabled = false;
    pause.disabled = true;
    stop.disabled = true;
    load.disabled = false;
    bar.classList.remove('progress-striped', 'active');
    progress.style.width = '0%';
  };
  load.addEventListener('click', event => {
    event.preventDefault();
    if (audio) { audio.pause(); audio.remove(); }
    const data = localStorage.ringtone;
    if (data === 'none') {
      modalDialog({title: modalTitle('exclamation-sign', i18n('optionsNotice')), content: i18n('optionsNoRingtone')});
      play.disabled = true;
      return;
    }
    if (data === 'database') {
      modalDialog({title: i18n('optionsNotice'), content: i18n('optionsNoRingtone')});
      return;
    }
    audio = document.createElement('audio');
    audio.src = !data || data === 'default' ? 'sounds/alarm.mp3' : data;
    audio.className = 'hide';
    document.body.append(audio);
    reset();
    load.textContent = i18n('optionsLoaded');
    setTimeout(() => { load.replaceChildren(icon('floppy-open'), ' ' + i18n('optionsLoad')); }, 3000);
    audio.addEventListener('ended', reset);
    audio.addEventListener('play', () => {
      load.disabled = true;
      bar.classList.add('progress-striped', 'active');
      clearInterval(timer);
      timer = setInterval(() => {
        progress.style.width = Number.isFinite(audio.duration) && audio.duration > 0 ?
          audio.currentTime / audio.duration * 100 + '%' : '0%';
      }, 100);
    });
  });
  play.addEventListener('click', () => {
    if (!audio) return;
    audio.play();
    play.disabled = true;
    pause.disabled = false;
    stop.disabled = false;
  });
  pause.addEventListener('click', () => {
    if (!audio) return;
    audio.pause();
    clearInterval(timer);
    pause.disabled = true;
    play.disabled = false;
  });
  stop.addEventListener('click', () => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    reset();
  });
}

function setupAppearanceEditor(kind) {
  const button = $id(kind === 'analog' ? 'editAnalog' : 'editDigital');
  button.addEventListener('click', () => {
    const definition = JSON.parse(localStorage.clockDefinition || '{}');
    const content = document.createElement('div');
    const heading = document.createElement('p');
    const bold = document.createElement('b');
    bold.textContent = i18n('optionsAdvanced');
    heading.append(bold);
    const description = document.createElement('p');
    description.textContent = i18n('optionsAppearanceHint');
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.rows = 15;
    textarea.spellcheck = false;
    textarea.value = JSON.stringify(definition[kind], null, 4);
    content.append(heading, description, textarea);
    const modal = modalDialog({
      title: i18n(kind === 'analog' ? 'optionsEditAnalog' : 'optionsEditDigital'),
      content,
      buttons: [{
        title: i18n('OK'), primary: true,
        onclick() {
          try {
            definition[kind] = JSON.parse(textarea.value);
          } catch {
            LegacyBackground.createNoti({title: i18n('optionsInvalidJson'), message: i18n('optionsEnterValidJson')});
            return;
          }
          localStorage.clockDefinition = JSON.stringify(definition);
          syncLegacyOption('clockDefinition');
          Components.getSingleton('BrowserActionHandler').updateIcon();
          hideBootstrapModal(modal);
        }
      }],
      onShown: () => textarea.focus()
    });
  });
}

function setupSidebar() {
  const links = $all('#list > a[href]');
  const scrollToHash = hash => {
    const section = $id(hash.slice(1));
    if (section) window.scrollTo({top: section.getBoundingClientRect().top + window.scrollY - 85, behavior: 'smooth'});
  };
  links.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    history.replaceState(null, '', link.hash);
    scrollToHash(link.hash);
  }));
  window.addEventListener('hashchange', () => { if (location.hash) scrollToHash(location.hash); });
  window.addEventListener('scroll', () => {
    const top = window.scrollY + 85;
    links.forEach(link => { link.style.borderLeft = ''; });
    $all('.card').forEach(card => {
      if (card.offsetTop <= top && top < card.offsetTop + card.clientHeight + 22) {
        const link = links.find(item => item.hash === '#' + card.id);
        if (link) link.style.borderLeft = '3px solid #428bca';
      }
    });
  });
  const resize = () => {
    const last = $all('.card').at(-1);
    $id('spacer').style.height = Math.max(0, window.innerHeight - last.offsetHeight - 108) + 'px';
  };
  window.addEventListener('resize', resize);
  resize();
  window.dispatchEvent(new Event('scroll'));
  if (location.hash) setTimeout(() => scrollToHash(location.hash), 0);
}

function setupOptions() {
  document.title = i18n('settings');
  i18n.translate();
  $all('gly').forEach(glyph => {
    const replacement = icon(glyph.getAttribute('icon'));
    replacement.className += ' ' + glyph.className;
    glyph.replaceWith(replacement);
  });
  setupFileButtons();
  const voiceMenu = $id('vc_engine').nextElementSibling;
  chrome.tts.getVoices(voices => {
    const selected = JSON.parse(localStorage.voice || '{"voiceName":"native"}').voiceName;
    for (const voice of voices) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = voice.voiceName;
      link.setAttribute('value', voice.voiceName);
      item.append(link);
      voiceMenu.append(item);
      link.addEventListener('click', event => { event.preventDefault(); chooseDropdown(link); });
    }
    if (voices.length) {
      const link = Array.from(voiceMenu.querySelectorAll('a')).find(item => item.getAttribute('value') === selected) ||
        voiceMenu.querySelector('a');
      chooseDropdown(link, false);
    }
  });
  initBootstrapTooltip($all('[data-bs-toggle="tooltip"]'));
  $id('current_timezone').textContent = getCurrenttimezone();
  setupDropdowns();

  $id('testnotibtn').addEventListener('click', () =>
    Components.getSingleton('HourlyTimeAnnouncementHandler').displayNotification());
  setupWeather();
  $id('noti_ringtone').addEventListener('change', function() {
    readAudio(this, result => {
      localStorage.noti_sound = result;
      syncLegacyOption('noti_sound');
      modalDialog({title: modalTitle('ok-circle', i18n('optionsImported')), content: i18n('optionsTestSoundHint')});
    });
  });
  $id('ringtone').addEventListener('change', function() {
    readAudio(this, result => {
      localStorage.ringtone = result;
      syncLegacyOption('ringtone');
      modalDialog({title: modalTitle('ok-circle', i18n('optionsSuccess')), content: i18n('optionsImported')});
    });
  });
  setupAudioPlayer();
  $id('language').addEventListener('change', function() {
    localStorage.language = this.value;
    Promise.resolve(syncLegacyOption('language')).finally(() => location.reload());
  });
  $id('ring_url_input').addEventListener('blur', function() {
    const input = this;
    if (!input.value) return;
    if (!/^https?:\/\//i.test(input.value)) {
      const modal = modalDialog({
        title: modalTitle('exclamation-sign', i18n('optionsNotice')),
        content: i18n('optionsInvalidUrl'), closeBtn: false, backdrop: 'static',
        buttons: [
          {title: i18n('close'), onclick() { input.value = ''; hideBootstrapModal(modal); }},
          {title: i18n('optionsRetry'), primary: true, onclick() { hideBootstrapModal(modal); input.focus(); }}
        ]
      });
    } else {
      localStorage.ringtone = input.value;
      syncLegacyOption('ringtone');
    }
  });
  $id('lang_credits').addEventListener('click', event => { event.preventDefault(); showcredit(); });
  setupAppearanceEditor('analog');
  setupAppearanceEditor('digital');
  $id('openAboutPage').addEventListener('click', () => chrome.tabs.create({url: '/about.html'}));

  const updateIcon = () => Components.getSingleton('BrowserActionHandler').updateIcon();
  const color = function() { this.style.background = this.value; updateIcon(); };
  [
    {id: 'dark_mode', type: 'boolean', key: 'use_dark_mode', onChange: updateIcon},
    {id: 'font_color', type: 'string', key: 'clockcolor_value', onChange: color, changeAtInit: true},
    {id: 'noscroll', type: 'boolean', key: 'show', onChange: updateIcon},
    {id: 'displayIcon', type: 'boolean', key: 'icon', onChange: updateIcon},
    {id: 'timeOnBadge', type: 'boolean', key: 'badge', onChange: updateIcon},
    {id: 'badge_color', type: 'string', key: 'badge_color', onChange: color, changeAtInit: true},
    {id: 'popup_design', type: 'custom', key: 'popup_version', LStoValue: [['1', true], ['0', false]],
      onChange: () => Components.getSingleton('BrowserActionHandler').updatePopup()},
    {id: 'lunar', type: 'boolean', key: 'lunar'},
    {id: 'pm', type: 'boolean', key: 'pm', onChange: updateIcon},
    {id: 'enable_timezone', type: 'boolean', key: 'enabletimezone', onChange: updateIcon},
    {id: 'timezone', type: 'select', key: 'timezone', onChange: updateIcon},
    {id: 'show_noti', type: 'boolean', key: 'shownotification'},
    {id: 'noti_bgColor', type: 'string', key: 'noti_bgColor', onChange: function() { this.style.background = this.value; }, changeAtInit: true},
    {id: 'show_noti_time', type: 'number', key: 'shownotificationtime'},
    {id: 'weather_woeid', type: 'string', key: 'weather', json: 'woeid'},
    {id: 'weather_name', type: 'static', key: 'weather', json: 'name'},
    {id: 'notisound', type: 'custom', key: 'noti_sound',
      LStoValueRegex: [[/^none$/, false], [/^data:audio.+$/, true]], regexAction() {},
      onClick() {
        if (this.checked) $id('noti_ringtone').click();
        else { localStorage.noti_sound = 'none'; syncLegacyOption('noti_sound'); }
      }},
    {id: 'noti_voice', type: 'boolean', key: 'noti_voice', json: 'enabled'},
    {id: 'noti_voice_text', type: 'string', key: 'noti_voice', json: 'text'},
    {id: 'noti_todo', type: 'boolean', key: 'shownotificationtodo'},
    {id: 'ring_loop', type: 'boolean', key: 'ring_loop'},
    {id: 'vc_engine', type: 'select', key: 'voice', json: 'voiceName'},
    {id: 'language', type: 'select', key: 'language'},
    {id: 'icon_update_interval', type: 'select', key: 'timeupdateicon'},
    {id: 'keepawake', type: 'boolean', key: 'keepawake'},
    {id: 'show_update', type: 'boolean', key: 'showupdate'},
    {id: 'bg_run', type: 'boolean', key: 'bg_run', onChange: function() {
      if (this.checked) {
        chrome.permissions.request({permissions: ['background']}, granted => {
          if (!granted) { this.checked = false; localStorage.bg_run = 'false'; }
        });
      } else {
        chrome.permissions.remove({permissions: ['background']}, removed => {
          if (!removed) { this.checked = true; localStorage.bg_run = 'true'; }
        });
      }
    }},
    {id: 'show_ctx_menu', type: 'boolean', key: 'context_menu_item_enable',
      onChange: function() {
        if (this.checked) LegacyBackground.createMenuItem();
        else chrome.contextMenus.removeAll();
      }},
    {name: 'clockmode', type: 'radio',
      onLoad() { this.checked = (this.id === 'digital') === (localStorage.use_digit === 'true'); },
      onClick() {
        if (!this.checked) return;
        localStorage.use_digit = String(this.id === 'digital');
        syncLegacyOption('use_digit');
        updateIcon();
        chrome.contextMenus.removeAll();
        LegacyBackground.createMenuItem();
      }},
    {name: 'noti_style', type: 'radio',
      onLoad() { this.checked = this.id === 'noti_style_' + localStorage.noti_style; },
      onChange() {
        if (this.checked) {
          localStorage.noti_style = this.id.replace('noti_style_', '');
          syncLegacyOption('noti_style');
        }
      }},
    {name: 'noti_display', type: 'radio',
      onLoad() { this.checked = (this.id === 'noti_close_manual') === (localStorage.manuallyclosenoti === 'true'); },
      onChange() {
        if (this.checked) {
          localStorage.manuallyclosenoti = String(this.id === 'noti_close_manual');
          syncLegacyOption('manuallyclosenoti');
        }
      }},
    {name: 'ringtone', type: 'radio',
      onLoad() {
        const stored = localStorage.ringtone;
        const choice = stored === 'none' ? 'ring_none' : stored === 'default' || !stored ?
          'ring_default' : stored === 'database' || /^data:audio/.test(stored) ? 'ring_comp' : 'ring_url';
        this.checked = this.id === choice;
        if (choice === 'ring_url') $id('ring_url_input').value = stored;
      },
      onClick() { if (this.id === 'ring_comp' && this.checked) $id('ringtone').click(); },
      onChange() {
        if (!this.checked) return;
        if (this.id === 'ring_none' || this.id === 'ring_default') {
          localStorage.ringtone = this.id === 'ring_none' ? 'none' : 'default';
          syncLegacyOption('ringtone');
        }
      }}
  ].forEach(bindOption);

  setupDateOrder();
  setupRequirements();
  setupSidebar();
  if ($id('ccversion')) $id('ccversion').textContent = chrome.runtime.getManifest().version;
  $id('facts').textContent = i18n('optionsFactLabel') + ' #' + (Math.floor(Math.random() * 100) + 50) +
    ': ' + i18n('optionsFact' + (Math.floor(Math.random() * 5) + 1));
}

setupOptions();
