"""Validate a browser release and turn its update.html entry into release notes."""
import argparse
import html
import json
import re
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[2]
VERSION = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']


def changelog_items():
    page = (ROOT / 'update.html').read_text(encoding='utf-8-sig')
    section = re.search(
        r'<h3\b[^>]*>\s*Ver\.\s*' + re.escape(VERSION) + r'\s*</h3>\s*<ul>(.*?)</ul>',
        page, re.IGNORECASE | re.DOTALL,
    )
    if not section:
        raise SystemExit(f'update.html has no Ver. {VERSION} entry')
    items = []
    for raw in re.findall(r'<li\b[^>]*>(.*?)</li>', section.group(1), re.IGNORECASE | re.DOTALL):
        item = html.unescape(re.sub(r'<[^>]*>', ' ', raw))
        item = ' '.join(item.split())
        if item:
            items.append(item)
    if not items:
        raise SystemExit(f'update.html has no notes for {VERSION}')
    return items


def check_archives():
    for browser in ('chrome', 'firefox'):
        path = ROOT / 'dist' / f'cool-clock-mv3-{browser}.zip'
        with ZipFile(path) as archive:
            damaged = archive.testzip()
            if damaged:
                raise SystemExit(f'{path.name}: corrupt entry {damaged}')
            names = set(archive.namelist())
            manifest = json.loads(archive.read('manifest.json'))
            if manifest['manifest_version'] != 3 or manifest['version'] != VERSION:
                raise SystemExit(f'{path.name}: manifest version mismatch')
            if manifest['action']['default_popup'] not in names:
                raise SystemExit(f'{path.name}: missing popup')
            background = manifest['background']
            scripts = [background['service_worker']] if browser == 'chrome' else background['scripts']
            if any(script not in names for script in scripts):
                raise SystemExit(f'{path.name}: missing background script')
            if '_locales/en/messages.json' not in names:
                raise SystemExit(f'{path.name}: missing translations')
        print(f'Checked {path.name}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=('version', 'notes', 'check'))
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9]+(?:\.[0-9]+){2,3}', VERSION):
        raise SystemExit(f'Invalid extension version: {VERSION}')
    if args.command == 'version':
        print(VERSION)
    elif args.command == 'notes':
        print(f'# Cool Clock v{VERSION}\n')
        for item in changelog_items():
            print(f'- {item}')
    else:
        changelog_items()
        check_archives()


if __name__ == '__main__':
    main()
