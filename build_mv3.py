"""Build Chrome and Firefox MV3 packages from the shared native JavaScript source."""
import copy
import json
import re
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())
source = sorted(path for path in (root / 'mv3').rglob('*') if path.is_file())
original_assets = [root / path for path in ('icons/16x16.png', 'icons/128x128.png', 'n_icon.png', 'sounds/alarm.mp3')]
legacy_popup = root / 'new_popup2.html'
legacy_assets = [root / path for path in (
    'scripts/new_popup2/css.css',
    'scripts/alarm_interface/css.css', 'scripts/countdown_interface/css.css',
    'scripts/timer/css.css', 'scripts/timer/js.js', 'scripts/stopwatch_split/js.js',
    'scripts/calendar_full/css.css', 'scripts/calendar_full/dialog_native.css',
    'scripts/options/css_new.css',
    'scripts/statistics/css.css',
    'd3/d3.v7.min.js', 'd3/D3-LICENSE',
    'scripts/about/css.css', 'scripts/update/css.css',
    'bootstrap/bootstrap.min.css', 'bootstrap/bootstrap.bundle.min.js',
    'bootstrap/icons.css', 'bootstrap/fonts/bootstrap-icons.woff',
    'bootstrap/icons-LICENSE', 'bootstrap/migration.css', 'bootstrap/native.js',
    'bootstrap/LICENSE',
    'input.css',
    'jstimezone.js', 'tools.js',
    'fonts/Roboto-Thin.ttf', 'fonts/Roboto-Regular.ttf', 'fonts/Roboto-Medium.ttf', 'fonts/NotoSans-Regular.ttf',
    'fonts/Oswald.woff',
    'fonts/LICENSE (Roboto).txt',
    'images/icons/timeline_24dp.png', 'images/icons/settings_24dp.png',
    'images/icons/help_24dp.png', 'images/icons/forum_24dp.png',
    'images/icons/info_24dp.png', 'images/icons/License',
    'scripts/popup/css.css', 'scripts/flipclock/js.js',
    'scripts/speech/css.css',
    'check.png', 'radio2.png', 'fonts/mic.woff',
    'images/to_left.png', 'images/to_left_down.png', 'images/to_right.png', 'images/to_right_down.png',
    'images/icons/clock.png', 'images/icons/clock_play.png', 'images/icons/clock_pause.png',
    'images/icons/gear.png', 'images/icons/bell.png', 'images/comment.png',
    'images/icons/clock_red.png', 'images/icons/chart_bar.png', 'icons/empty.png',
    'images/facebook_icon.gif', 'images/icons/clock_edit.png', 'images/icons/arrow_in.png',
    'images/icons/control_rewind_blue.png', 'images/icons/control_rewind.png',
    'images/icons/control_fastforward_blue.png', 'images/icons/control_fastforward.png',
)]
output_dir = root / 'dist'
output_dir.mkdir(exist_ok=True)


def locale_files():
    for path in sorted((root / '_locales').glob('*/messages.json')):
        language = path.parent.name
        contents = path.read_text(encoding='utf-8-sig')
        json.loads(contents)
        yield f'_locales/{language}/messages.json', contents

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
        speech_html = speech_html.replace('</head>', '<script src="/mv3/locale_catalog.js" defer></script><script src="/mv3/i18n.js" defer></script><script src="/mv3/legacy_speech.js" defer></script></head>', 1)
        archive.writestr('speech.html', speech_html)
        archive.write(root / 'flipclock.html', 'flipclock.html')
        small_calendar_html = (root / 'calendar.html').read_text(encoding='utf-8-sig')
        small_calendar_html = re.sub(r'<script\b[^>]*>\s*</script>', '', small_calendar_html, flags=re.I)
        small_calendar_html = small_calendar_html.replace('</head>', '<script src="/mv3/legacy_small_calendar.js" defer></script></head>', 1)
        archive.writestr('calendar.html', small_calendar_html)
        for page in ('timer.html', 'stopwatch_split.html'):
            archive.write(root / page, page)
        translation = (root / 'translation.js').read_text(encoding='utf-8-sig').replace('chrome.extension.getURL', 'chrome.runtime.getURL')
        translation = translation.replace('if(window.Components && Components.getSingleton("Localization")){', 'if(window.Components && typeof Components.getSingleton === "function" && Components.getSingleton("Localization")){')
        archive.writestr('translation.js', translation)
        for page, controller in [('alarm_interface.html', 'alarm_interface'), ('countdown_interface.html', 'countdown_interface')]:
            html = (root / page).read_text(encoding='utf-8-sig')
            html = re.sub(r'<script\b[^>]*src="/scripts/' + controller + r'/js\.js"[^>]*>\s*</script>', '', html)
            html = html.replace('</head>', '<script src="/mv3/legacy_bridge.js" defer></script></head>', 1)
            archive.writestr(page, html)
            code = (root / 'scripts' / controller / 'js.js').read_text(encoding='utf-8-sig')
            archive.writestr('mv3/original_' + ('alarm' if controller == 'alarm_interface' else 'countdown') + '.js', code)
        calendar_html = (root / 'calendar_full.html').read_text(encoding='utf-8-sig')
        calendar_html = re.sub(r'<script\b[^>]*src="/scripts/calendar_full/js\.js"[^>]*>\s*</script>', '', calendar_html)
        calendar_html = calendar_html.replace('</head>', '<script src="/mv3/legacy_bridge.js" defer></script><script src="/mv3/legacy_calendar_import.js" defer></script></head>', 1)
        archive.writestr('calendar_full.html', calendar_html)
        archive.writestr('mv3/original_calendar.js', (root / 'scripts/calendar_full/js.js').read_text(encoding='utf-8-sig'))
        options_html = (root / 'options_new.html').read_text(encoding='utf-8-sig')
        options_html = re.sub(r'<script\b[^>]*src="/scripts/options/js_new\.js"[^>]*>\s*</script>', '', options_html)
        options_html = options_html.replace('Weather information provided by Yahoo! Weather', 'Weather information provided by Open-Meteo')
        options_html = options_html.replace('This shows the WOEID of the current location.', 'This shows the location ID.')
        options_html = options_html.replace('</head>', '<script src="/mv3/legacy_bridge.js" defer></script></head>', 1)
        archive.writestr('options_new.html', options_html)
        archive.writestr('mv3/original_options.js', (root / 'scripts/options/js_new.js').read_text(encoding='utf-8-sig'))
        stats_html = (root / 'statistics.html').read_text(encoding='utf-8-sig')
        stats_html = re.sub(r'<script\b[^>]*>\s*</script>', '', stats_html)
        stats_html = stats_html.replace('</head>', '<script src="/d3/d3.v7.min.js" defer></script><script src="/mv3/locale_catalog.js" defer></script><script src="/mv3/i18n.js" defer></script><script src="/mv3/legacy_stats.js" defer></script></head>', 1)
        archive.writestr('statistics.html', stats_html)
        for page, replacement in (
            ('about.html', 'legacy_about.js'),
            ('update.html', 'legacy_update.js'),
        ):
            html = (root / page).read_text(encoding='utf-8-sig')
            html = re.sub(r'<script\b[^>]*>\s*</script>', '', html)
            html = html.replace('</head>', f'<script src="/mv3/locale_catalog.js" defer></script><script src="/mv3/i18n.js" defer></script><script src="/mv3/{replacement}" defer></script></head>', 1)
            archive.writestr(page, html)
        for path, contents in locale_files():
            archive.writestr(path, contents)
    print(output)
