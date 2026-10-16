# Cool Clock MV3

Manifest V3 port of Derek Leung's Cool Clock. Version 4.1.2 retains the original popup layouts and features, icons, sound, and translations while updating the interface to Bootstrap 5.3.8 and Bootstrap Icons 1.13.2. Page controllers use native JavaScript without jQuery. The full calendar uses native dialogs with local CSS. The statistics page uses bundled D3 v7.9.0. Some interface and icon details differ from the original.

## Build and install

Run `python3 build_mv3.py`. The resulting archives are:

- `dist/cool-clock-mv3-chrome.zip` for Chrome 120 or newer. Unzip it and choose **Load unpacked** at `chrome://extensions`.
- `dist/cool-clock-mv3-firefox.zip` for Firefox 121 or newer. It uses an MV3 background event page and includes a Gecko add-on ID for signing.

The Chrome package uses a service worker plus an offscreen document for audio and clipboard operations. The Firefox package uses a background event page. Both packages include the original UI resources, original `_locales`, Bootstrap 5 CSS and JavaScript, a local subset of Bootstrap Icons 1.13.2, and D3 with its license.

## Source layout

The repository keeps `manifest.json`, the build script, and release workflow at its root. Extension sources are grouped under `src/`:

| Directory | Contents | Location in the built extension |
| --- | --- | --- |
| `src/pages/` | Popup, settings, calendar, and other HTML pages | Extension root, except the weather details page under `mv3/` |
| `src/runtime/` | Background worker, offscreen document, and page bridge | `mv3/` |
| `src/ui/` | Page controllers and styles | `scripts/` |
| `src/shared/` | Shared scripts and input styles | Extension root or `mv3/`, according to the existing resource URL |
| `src/assets/` | Icons, images, fonts, and sounds | Their original extension paths |
| `src/vendor/` | Bundled Bootstrap and D3 with their licenses | `bootstrap/` and `d3/` |
| `src/locales/` | Translations | `_locales/` |

Edit files in `src/` and run `python3 build_mv3.py`. The build preserves the extension's existing URLs and relative resource paths. Files not selected by the build remain in `src/` for reference and are not packaged.

To publish a new GitHub release, change the version in `manifest.json` and add a matching `Ver. X.Y.Z` entry to `src/pages/update.html`, then push both changes to `master`. The [release workflow](.github/workflows/release.yml) builds and checks both browser archives, creates the `vX.Y.Z` tag, and attaches both ZIP files to the release. It skips a version that already has a release. The workflow can also be run manually to retry a release.

The default popup is the original blue 300 × 500 design. The original 250px popup is also available through the original **Popup Design** setting. Alarms, repeating countdowns, calendar todos, hourly announcements, voice and text commands, address bar `clock` commands, and the main original settings controls are connected to MV3 storage and browser APIs. The original Yahoo weather service has been replaced with Open-Meteo. Weather location can be chosen by search or by checking **Use browser location automatically** in settings. Device location is refreshed when the popup or forecast opens, and both open weather views refresh every five minutes; the last successful location is used when a refresh fails. Automatic location is labeled **Current location**; turning it off keeps the last coordinates as a fixed weather location. Clicking the popup weather opens a seven-day forecast. Weather defaults to Celsius, can be switched to Fahrenheit, and shows current humidity when available. Public Google Calendars can be imported through iCal, and private calendars can be imported from an exported `.ics` file.

The original Chrome Web Store listing ID cannot be reused for a new listing.

Settings from `options_new.html` sync through the browser's `storage.sync` by default. Clear **Sync settings** in the Extension section to keep settings on this device. Chrome and Firefox use separate account systems, so settings sync only between installations of the same browser. Alarms, countdowns, todos, stopwatch data, usage history, and automatic weather coordinates remain local. Imported audio files that exceed the browser's sync storage limit also remain local.

Each page loads its settings before initializing its controls. The popup, alarms, countdowns, and calendar request current state from the background; page-specific preferences and stopwatch data use `storage.local` directly. The old synchronous `legacyStore` layer is no longer included.

## Known limits

- Direct Google sign-in for private calendar import needs a new OAuth client and is not included. Use Google Calendar's `.ics` export instead.
- The iCal importer reads events' start dates; complex recurring rules are not expanded.
- The statistics charts record new sessions. Historical usage stored by the original WebSQL implementation cannot be migrated on current browsers.
- Automatic weather location requires the browser's geolocation permission and an available location provider. Current coordinates are sent to Open-Meteo for weather. If geolocation fails, the last saved coordinates are used. Adding the geolocation permission may require approval when updating an installed extension.
- Chrome hourly announcements offer compact list and image layouts, with a newly drawn clock image. Firefox uses its basic notification layout. Notification pixels can differ from the original.
- Voice recognition depends on the browser's Speech Recognition API; text commands work when voice recognition is unavailable.
- The toolbar clock is drawn with modern Canvas APIs and honors the original digital/analog, color, badge, and several advanced appearance settings. Some advanced clock definition fields and individual pixels differ from the original graphics engine.
- Firefox does not support Chrome's `power` API, so the **Prevent system from sleeping** setting works in Chrome only.
- Open-Meteo reachability from mainland China has not been verified from a mainland network. Weather needs a network connection.

## Publishing

The original repository has no project-level license. Keep written permission from the original author for redistribution of the original code and resources before publishing. The D3 license is included in `src/vendor/d3/D3-LICENSE`; the original icon license is included in `src/assets/images/icons/License`; the Roboto license is included in `src/assets/fonts/LICENSE (Roboto).txt`.

Original resource credits: famfamfam Silk Icons (CC BY 2.5), Material Icons (Apache 2.0), Roboto, Noto Sans, Oswald, Meteocons, and Sound Jay. The Bootstrap 5 license is included in `src/vendor/bootstrap/LICENSE`; the Bootstrap Icons MIT license is included in `src/vendor/bootstrap/icons-LICENSE`.
