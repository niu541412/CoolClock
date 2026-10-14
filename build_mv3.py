"""Build Chrome and Firefox MV3 packages from the shared native JavaScript source."""
import copy
import json
import re
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())
additions = json.loads((root / 'mv3/locale_additions.json').read_text())
source = sorted(path for path in (root / 'mv3').rglob('*') if path.is_file() and path.name != 'locale_additions.json')
original_assets = [root / path for path in ('icons/16x16.png', 'icons/128x128.png', 'n_icon.png', 'sounds/alarm.mp3')]
legacy_popup = root / 'new_popup2.html'
legacy_assets = [root / path for path in (
    'scripts/new_popup2/css.css',
    'scripts/alarm_interface/css.css', 'scripts/countdown_interface/css.css',
    'scripts/timer/css.css', 'scripts/timer/js.js', 'scripts/stopwatch_split/js.js',
    'scripts/calendar_full/css.css', 'scripts/jquery_ui/jquery-ui-1.10.1.custom.min.js',
    'scripts/jquery_ui/sunny/jquery-ui-1.10.1.custom.min.css', 'gcfeed.js',
    'scripts/options/css_new.css', 'scripts/jquery_ui/jquery-ui-1.10.3.custom.min.js',
    'scripts/statistics/css.css',
    'scripts/about/css.css', 'scripts/update/css.css',
    'jquery.js', 'scripts/transit/jquery.transit.min.js',
    'bootstrap/bootstrap.min.css', 'bootstrap/bootstrap.min.js',
    'input.css',
    'jstimezone.js', 'tools.js',
    'fonts/Roboto-Thin.ttf', 'fonts/Roboto-Regular.ttf', 'fonts/NotoSans-Regular.ttf',
    'fonts/Oswald.woff', 'fonts/glyphicons-halflings-regular.woff',
    'fonts/LICENSE (Roboto).txt',
    'images/icons/timeline_24dp.png', 'images/icons/settings_24dp.png',
    'images/icons/help_24dp.png', 'images/icons/forum_24dp.png',
    'images/icons/info_24dp.png', 'images/icons/License',
    'scripts/popup/css.css', 'scripts/flipclock/js.js',
    'scripts/speech/css.css',
    'bootstrap/bootstrap-theme.min.css', 'check.png', 'radio2.png', 'fonts/mic.woff',
    'images/to_left.png', 'images/to_left_down.png', 'images/to_right.png', 'images/to_right_down.png',
    'images/icons/clock.png', 'images/icons/clock_play.png', 'images/icons/clock_pause.png',
    'images/icons/gear.png', 'images/icons/bell.png', 'images/comment.png',
    'images/icons/clock_red.png', 'images/icons/chart_bar.png', 'icons/empty.png',
    'images/facebook_icon.gif', 'images/icons/clock_edit.png', 'images/icons/arrow_in.png',
    'images/icons/control_rewind_blue.png', 'images/icons/control_rewind.png',
    'images/icons/control_fastforward_blue.png', 'images/icons/control_fastforward.png',
)]
legacy_assets += sorted(path for path in (root / 'scripts/jquery_ui/sunny/images').iterdir() if path.is_file())
output_dir = root / 'dist'
output_dir.mkdir(exist_ok=True)


def strip_json_comments(source_text):
    result, index, quoted, escaped = [], 0, False, False
    while index < len(source_text):
        char = source_text[index]
        if quoted:
            result.append(char)
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == '"':
                quoted = False
            index += 1
        elif char == '"':
            quoted = True
            result.append(char)
            index += 1
        elif source_text.startswith('/*', index):
            end = source_text.find('*/', index + 2)
            if end < 0:
                raise ValueError('Unclosed locale JSON comment')
            index = end + 2
        elif source_text.startswith('//', index):
            end = source_text.find('\n', index + 2)
            index = len(source_text) if end < 0 else end
        else:
            result.append(char)
            index += 1
    return ''.join(result)


def locale_files():
    for path in sorted((root / '_locales').glob('*/messages.json')):
        language = path.parent.name
        original = json.loads(strip_json_comments(path.read_text(encoding='utf-8-sig')))
        for key, value in additions.get(language, {}).items():
            if key == 'extDes':
                continue
            original[key] = {'message': value}
        yield f'_locales/{language}/messages.json', json.dumps(original, ensure_ascii=False, indent=2) + '\n'

firefox = copy.deepcopy(manifest)
firefox['background'] = {'scripts': ['mv3/locale_catalog.js', 'mv3/i18n.js', 'mv3/offscreen.js', 'mv3/worker.js']}
firefox['permissions'].remove('offscreen')
firefox['permissions'].remove('tts')
firefox['permissions'].remove('power')
firefox.pop('minimum_chrome_version', None)
firefox['browser_specific_settings'] = {'gecko': {
    'id': '{76647e60-fd31-46cf-9b37-28fd1fd4804b}',
    'strict_min_version': '121.0',
    'data_collection_permissions': {'required': ['none'], 'optional': ['locationInfo']},
}}

for browser, configured in [('chrome', manifest), ('firefox', firefox)]:
    output = output_dir / f'cool-clock-mv3-{browser}.zip'
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('manifest.json', json.dumps(configured, ensure_ascii=False, indent=2) + '\n')
        for path in source + original_assets:
            if browser == 'firefox' and path.name == 'offscreen.html':
                continue
            archive.write(path, path.relative_to(root))
        catalog = {}
        for locale_path, contents in locale_files():
            language = locale_path.split('/')[1]
            catalog[language] = {key: value['message'] for key, value in json.loads(contents).items()}
        archive.writestr('mv3/locale_catalog.js', 'globalThis.COOL_CLOCK_LOCALES = ' + json.dumps(catalog, ensure_ascii=False) + ';\n')
        for path in legacy_assets:
            if path.relative_to(root).as_posix() == 'scripts/timer/css.css':
                archive.writestr('scripts/timer/css.css', path.read_text(encoding='utf-8-sig').replace('Roboto-Regular.tff', 'Roboto-Regular.ttf'))
            else:
                archive.write(path, path.relative_to(root))
        popup_html = legacy_popup.read_text(encoding='utf-8-sig')
        popup_html = re.sub(r'<script\b[^>]*>\s*</script>', '', popup_html)
        popup_html = popup_html.replace('<head>', '<head><meta charset="utf-8">', 1)
        popup_html = popup_html.replace('</head>', '<script src="/mv3/locale_catalog.js" defer></script><script src="/mv3/i18n.js" defer></script><script src="/mv3/legacy_popup.js" defer></script></head>', 1)
        archive.writestr('new_popup2.html', popup_html)
        old_popup_html = (root / 'popup.html').read_text(encoding='utf-8-sig')
        old_popup_html = re.sub(r'<script\b[^>]*>\s*</script>', '', old_popup_html)
        old_popup_html = old_popup_html.replace('</head>', '<script src="/mv3/locale_catalog.js" defer></script><script src="/mv3/i18n.js" defer></script><script src="/mv3/legacy_old_popup.js" defer></script></head>', 1)
        archive.writestr('popup.html', old_popup_html)
        speech_html = (root / 'speech.html').read_text(encoding='utf-8-sig')
        speech_html = re.sub(r'<script\b[^>]*>\s*</script>', '', speech_html)
        speech_html = speech_html.replace('</head>', '<script src="/mv3/legacy_speech.js" defer></script></head>', 1)
        archive.writestr('speech.html', speech_html)
        archive.write(root / 'flipclock.html', 'flipclock.html')
        small_calendar_html = (root / 'calendar.html').read_text(encoding='utf-8-sig')
        small_calendar_html = re.sub(r'<script\b[^>]*src="/scripts/calendar/js\.js"[^>]*>\s*</script>', '', small_calendar_html, flags=re.I)
        small_calendar_html = small_calendar_html.replace('</head>', '<script src="/mv3/legacy_small_calendar.js" defer></script></head>', 1)
        archive.writestr('calendar.html', small_calendar_html)
        for page in ('timer.html', 'stopwatch_split.html'):
            archive.write(root / page, page)
        translation = (root / 'translation.js').read_text(encoding='utf-8-sig').replace('chrome.extension.getBackgroundPage().$', 'window.jQuery').replace('chrome.extension.getURL', 'chrome.runtime.getURL')
        translation = translation.replace('if(window.Components && Components.getSingleton("Localization")){', 'if(window.Components && typeof Components.getSingleton === "function" && Components.getSingleton("Localization")){')
        archive.writestr('translation.js', translation)
        for page, controller in [('alarm_interface.html', 'alarm_interface'), ('countdown_interface.html', 'countdown_interface')]:
            html = (root / page).read_text(encoding='utf-8-sig')
            html = re.sub(r'<script\b[^>]*src="/scripts/' + controller + r'/js\.js"[^>]*>\s*</script>', '', html)
            html = html.replace('</head>', '<script src="/mv3/legacy_bridge.js" defer></script></head>', 1)
            archive.writestr(page, html)
            code = (root / 'scripts' / controller / 'js.js').read_text(encoding='utf-8-sig').replace('chrome.extension.getBackgroundPage()', 'LegacyBackground')
            if controller == 'alarm_interface':
                code = re.sub(r'createModal = function\(options\)\{\s*return LegacyBackground\.Functions\.createModal\(options, window\);\s*\}', '', code)
            else:
                code = code.replace('}).data("value", false);', '}).data("value", false);\n\trestoreLegacyCountdownPreset();', 1)
            archive.writestr('mv3/original_' + ('alarm' if controller == 'alarm_interface' else 'countdown') + '.js', code)
        calendar_html = (root / 'calendar_full.html').read_text(encoding='utf-8-sig')
        calendar_html = re.sub(r'<script\b[^>]*src="/scripts/calendar_full/js\.js"[^>]*>\s*</script>', '', calendar_html)
        calendar_html = calendar_html.replace('Import from public Google Calendar:', 'Import from public Google Calendar (email or iCal URL):')
        calendar_html = calendar_html.replace('Import from private Google Calendar: <span style="font-size: 14px">(Make sure you have logged in)</span>', 'Import from private Google Calendar: <span style="font-size: 14px">(Choose an exported .ics file)</span>')
        calendar_html = calendar_html.replace('<input type="email" placeholder="Public calendar email...">', '<input type="text" placeholder="Public calendar email or iCal URL...">')
        calendar_html = calendar_html.replace('</head>', '<script src="/mv3/legacy_bridge.js" defer></script><script src="/mv3/legacy_calendar_import.js" defer></script></head>', 1)
        archive.writestr('calendar_full.html', calendar_html)
        calendar_code = (root / 'scripts/calendar_full/js.js').read_text(encoding='utf-8-sig').replace('chrome.extension.getBackgroundPage()', 'LegacyBackground')
        calendar_code = re.sub(r'parseInt\(navigator\.appVersion\.match\(/Chrome\\/\(\[\^\\s\]\+\)\\s/\)\[1\], 10\) < 21', 'false', calendar_code)
        calendar_code = calendar_code.replace('localStorage["todo"] = JSON.stringify(list);', 'localStorage["todo"] = JSON.stringify(list); syncLegacyTodos();')
        calendar_code = calendar_code.replace('localStorage["todo"] = "{}";', 'localStorage["todo"] = "{}"; syncLegacyTodos();')
        calendar_code = calendar_code.replace('new Date(year,month,date)', 'new Date(year,month-1,date)')
        calendar_code = calendar_code.replace('entry = $("<div>").addClass("entry").html(text)', 'entry = $("<div>").addClass("entry").text(text)')
        calendar_code = re.sub(r'\$\("button#importCalendar"\)\.click\(function\(\)\{[\s\S]*?\n\s*//Lowever than Chrome 21', '// iCal imports are handled by legacy_calendar_import.js.\n\t//Lowever than Chrome 21', calendar_code, count=1)
        archive.writestr('mv3/original_calendar.js', calendar_code)
        options_html = (root / 'options_new.html').read_text(encoding='utf-8-sig')
        options_html = re.sub(r'<script\b[^>]*src="/scripts/options/js_new\.js"[^>]*>\s*</script>', '', options_html)
        options_html = options_html.replace('Weather information provided by Yahoo! Weather', 'Weather information provided by Open-Meteo')
        options_html = options_html.replace('This shows the WOEID of the current location.', 'This shows the location ID.')
        options_html = options_html.replace('</head>', '<script src="/mv3/legacy_bridge.js" defer></script></head>', 1)
        archive.writestr('options_new.html', options_html)
        options_code = (root / 'scripts/options/js_new.js').read_text(encoding='utf-8-sig').replace('chrome.extension.getBackgroundPage()', 'LegacyBackground')
        options_code = re.sub(r'createModal = function\(options\)\{\s*return LegacyBackground\.Functions\.createModal\(options, window\);\s*\}', '', options_code)
        options_code = options_code.replace('Components.getSingleton("Localization").setSelectedLanguage(this.value);', 'localStorage.language = this.value; syncLegacyOption("language");')
        options_code = re.sub(r'\s*//G\+ Share[\s\S]*?\s*//Facts', '\n\t//Facts', options_code)
        options_code = re.sub(r'function yqlSearch\(\)\{[\s\S]*?\n\s*searchBtn\.click\(yqlSearch\);', '''async function yqlSearch(){
                    resultArea.empty().append($('<div>').addClass('text-center').text('Loading...'));
                    try {
                        const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(search.val().trim()) + '&count=8&language=' + encodeURIComponent(navigator.language.slice(0, 2));
                        const response = await fetch(url);
                        if(!response.ok) throw new Error('HTTP ' + response.status);
                        const places = (await response.json()).results || [];
                        resultArea.empty();
                        if(!places.length) resultArea.append($('<div>').addClass('list-group-item').text('No result'));
                        places.forEach(function(place){
                            const label = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
                            $('<a href="#">').addClass('list-group-item').text(label).appendTo(resultArea).click(function(event){
                                event.preventDefault();
                                const weather = {enabled: true, name: label, woeid: String(place.id), latitude: place.latitude, longitude: place.longitude};
                                localStorage.weather = JSON.stringify(weather);
                                $('#weather_woeid').val(weather.woeid);
                                $('#weather_name').text(label);
                                $('#weather').prop('checked', true);
                                syncLegacyOption('weather');
                                modal.modal('hide');
                            });
                        });
                    } catch(error) {
                        resultArea.empty().append($('<div>').addClass('list-group-item').text('Error fetching data: ' + error.message));
                    }
                }
                searchBtn.click(yqlSearch);''', options_code, count=1)
        options_code = options_code.replace('localStorage["weather"] = JSON.stringify(obj);', 'localStorage["weather"] = JSON.stringify(obj); syncLegacyOption("weather");')
        options_code = options_code.replace('$("input, button", affectedEle).prop("disabled", !state);', '$("input, button", affectedEle).not("#weather, #weather_search, #weather_woeid").prop("disabled", !state);')
        options_code = re.sub(r'var isDB = false;[\s\S]*?var modal = createModal\(\{', 'localStorage["ringtone"] = result; syncLegacyOption("ringtone");\n\t\t\t\t\tvar modal = createModal({', options_code, count=1)
        options_code = options_code.replace('localStorage["ringtone"] = "none";', 'localStorage["ringtone"] = "none"; syncLegacyOption("ringtone");')
        options_code = options_code.replace('localStorage["ringtone"] = "default";', 'localStorage["ringtone"] = "default"; syncLegacyOption("ringtone");')
        options_code = options_code.replace('localStorage["ringtone"] = input.value;', 'localStorage["ringtone"] = input.value; syncLegacyOption("ringtone");')
        options_code = options_code.replace('localStorage["noti_sound"] = result;', 'localStorage["noti_sound"] = result; syncLegacyOption("noti_sound");')
        options_code = options_code.replace('localStorage["noti_sound"] = "none";', 'localStorage["noti_sound"] = "none"; syncLegacyOption("noti_sound");')
        options_code = options_code.replace('localStorage["manuallyclosenoti"] = (this.id === "noti_close_manual").toString();', 'localStorage["manuallyclosenoti"] = (this.id === "noti_close_manual").toString(); syncLegacyOption("manuallyclosenoti");')
        options_code = options_code.replace("if(file.type.match('audio.mp3') || file.type.match('audio.ogg') || file.type.match('audio.wav'))", "if(/^audio\\/(mpeg|mp3|ogg|wav|x-wav|wave)$/.test(file.type))")
        options_code = options_code.replace('obj.onChange.call(this, e);', 'obj.onChange.call(this, e); syncLegacyOption(obj.key);')
        options_code = options_code.replace('Components.getSingleton("BrowserActionHandler").updateIcon();', 'Components.getSingleton("BrowserActionHandler").updateIcon();')
        archive.writestr('mv3/original_options.js', options_code)
        stats_html = (root / 'statistics.html').read_text(encoding='utf-8-sig')
        stats_html = re.sub(r'<script\b[^>]*src="/d3/d3\.v3\.min\.js"[^>]*>\s*</script>', '', stats_html)
        stats_html = re.sub(r'<script\b[^>]*src="/scripts/statistics/js\.js"[^>]*>\s*</script>', '', stats_html)
        stats_html = stats_html.replace('</head>', '<script src="/mv3/vendor/d3.v7.min.js"></script><script src="/mv3/locale_catalog.js" defer></script><script src="/mv3/i18n.js" defer></script><script src="/mv3/legacy_stats.js" defer></script></head>', 1)
        archive.writestr('statistics.html', stats_html)
        for page, old_script, replacement in (
            ('about.html', '/scripts/about/js.js', 'legacy_about.js'),
            ('update.html', '/scripts/update/js.js', 'legacy_update.js'),
        ):
            html = (root / page).read_text(encoding='utf-8-sig')
            html = re.sub(r'<script\b[^>]*src="' + re.escape(old_script) + r'"[^>]*>\s*</script>', '', html)
            html = html.replace('</head>', f'<script src="/mv3/locale_catalog.js" defer></script><script src="/mv3/i18n.js" defer></script><script src="/mv3/{replacement}" defer></script></head>', 1)
            archive.writestr(page, html)
        for path, contents in locale_files():
            archive.writestr(path, contents)
    print(output)
