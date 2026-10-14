# Cool Clock MV3

Manifest V3 port of Derek Leung's Cool Clock. The release packages retain the original popup layouts, settings page, alarm and countdown windows, stopwatch, calendar, icons, sound, and translations. jQuery remains in the original pages for visual and interaction fidelity. The statistics page uses bundled D3 v7.9.0.

## Build and install

Run `python3 build_mv3.py`. The resulting archives are:

- `dist/cool-clock-mv3-chrome.zip` for Chrome 120 or newer. Unzip it and choose **Load unpacked** at `chrome://extensions`.
- `dist/cool-clock-mv3-firefox.zip` for Firefox 121 or newer. It uses an MV3 background event page and includes a Gecko add-on ID for signing.

The Chrome package uses a service worker plus an offscreen document for legacy data import and audio. The Firefox package uses a background event page. Both packages include the original UI resources, original `_locales`, bundled jQuery, and D3 with its license.

To publish a new GitHub release, change the version in `manifest.json` and add a matching `Ver. X.Y.Z` entry to `update.html`, then push both changes to `master`. The [release workflow](.github/workflows/release.yml) builds and checks both browser archives, creates the `vX.Y.Z` tag, and attaches both ZIP files to the release. It skips a version that already has a release. The workflow can also be run manually to retry a release.

The default popup is the original blue 300 × 500 design. The original 250px popup is also available through the original **Popup Design** setting. Alarms, repeating countdowns, calendar todos, hourly announcements, voice and text commands, address bar `clock` commands, and the main original settings controls are connected to MV3 storage and browser APIs. The original Yahoo weather service has been replaced with Open-Meteo; the location search remains in the original settings page, and clicking the popup weather opens a seven-day forecast. Public Google Calendars can be imported through iCal, and private calendars can be imported from an exported `.ics` file.

On an in-place update with the same extension ID, the first run imports alarms, countdowns, todos, and clock preferences from extension `localStorage`. A new extension ID has a separate storage area and cannot read the old installation's data. The original Chrome Web Store listing ID cannot be reused for a new listing.

## Known limits

- Direct Google sign-in for private calendar import needs a new OAuth client and is not included. Use Google Calendar's `.ics` export instead.
- The iCal importer reads events' start dates; complex recurring rules are not expanded.
- The statistics charts record new sessions. Historical usage stored by the original WebSQL implementation cannot be migrated on current browsers.
- Chrome hourly announcements offer compact list and image layouts, with a newly drawn clock image. Firefox uses its basic notification layout. Notification pixels can differ from the original.
- Voice recognition depends on the browser's Speech Recognition API; text commands work when voice recognition is unavailable.
- The toolbar clock is drawn with modern Canvas APIs and honors the original digital/analog, color, badge, and several advanced appearance settings. Some advanced clock definition fields and individual pixels differ from the original graphics engine.
- Firefox does not support Chrome's `power` API, so the **Prevent system from sleeping** setting works in Chrome only.
- Open-Meteo reachability from mainland China has not been verified from a mainland network. Weather needs a network connection.

## Publishing

The original repository has no project-level license. Keep written permission from the original author for redistribution of the original code and resources before publishing. The D3 license is included in `d3/D3-LICENSE`; the original icon license is included in `images/icons/License`; the Roboto license is included in `fonts/LICENSE (Roboto).txt`.

Original resource credits: famfamfam Silk Icons (CC BY 2.5), Material Icons (Apache 2.0), Glyphicons, Roboto, Noto Sans, Oswald, Meteocons, and Sound Jay. The bundled jQuery and Bootstrap files retain their license headers.
