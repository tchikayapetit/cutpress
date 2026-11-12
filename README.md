# CutPress

Turn a word or a photo into a match cut across real-looking newspapers, magazines and books.
There is no backend. Page rendering, sound, and video export all run in the browser, and nothing is uploaded.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Deploy

It is a static site with no build step. Drag the folder into Netlify Drop, or import it in Vercel, Cloudflare Pages or GitHub Pages.

## How it works

**Word cut.** Type a line and tap the word to land on. Each frame is a close-up of a different printed page with the word in the same spot on screen. The pages are real typography with readable sentences, columns, headlines, pull quotes, paper texture, ink and depth-of-field blur.

**Photo cut.** Add one or more photos and a headline. The photo is printed on page after page (halftone newsprint, glossy magazine, web page, poster, TV screen), each filmed from a different angle and zoom.

**56 styles in 7 groups.** All names and text are invented.
- Old front pages (default for Photo cut): 1910s, 1930s, EXTRA edition, 1960s and modern front pages. They have blackletter mastheads with side boxes, condensed banner headlines, stacked sub-headlines, 6–8 ruled columns, extra photos and small ads, and yellowed, foxed, folded and torn paper. Also a red-top tabloid, a pile of newspapers and a newsstand spread.
- Close-up print: newspaper, magazine, old newspaper, tabloid, business paper, book page, report, typed memo.
- Newspapers: front page, tabloid, 1920s paper, business paper, sports page, local weekly, classifieds, clipping on a desk, weekend supplement.
- Magazines: fashion cover, news weekly cover, magazine spread, music magazine, travel magazine, celebrity weekly, business magazine.
- Web & screens: blog post, news website, photo post, text post, video page, phone news app, TV news.
- Posters: wanted poster, missing poster, event poster, vintage poster, movie poster.
- Desk & objects: pinboard, book cover, record sleeve, framed photo on a wall, photo booth strip, press badge.

**Camera.** Every frame is filmed by a virtual camera. It changes the angle, zoom, position and perspective tilt, adds the surface underneath (wood, linen, slate, cork), and applies shadows and depth of field. In Photo cut, the photo moves around the screen. In Word cut, the word stays locked in the centre.

**Filler photos.** Pages use free Unsplash photos (Unsplash License: free for commercial use, no attribution needed) of places, food and buildings, with no people. They load from Unsplash's CDN in the viewer's browser. If they can't load, generated pictures are used instead.

**Sound.** 67 synthesized sound effects (paper shuffle, camera shutter, film advance, Polaroid, flash pop, whooshes, impacts and more), the same sounds as the first version. There are also 34 generated music tracks, and you can upload your own song (tempo and drop are detected). Any sound can be previewed, saved as a favourite or downloaded as WAV.

**Length and speed.** Choose any video length from 2 to 60 seconds and any cut speed from 0.5 to 15 cuts per second. The default is 6 seconds at 8 cuts per second. With music, the speed locks to the beat. Long videos reuse up to 48 unique pages to keep memory low.

**Old paper look.** Photo cut has an on/off sepia, faded, grainy grade over every frame. The pile, newsstand and archive-table scenes mix in real scanned front pages from 1900–1960. These are public domain and are listed live from Wikimedia Commons (Category: Front pages of newspapers of the United States).

**English and French.** A language button in the top bar (it follows the browser language the first time). Every menu, button, tooltip and message is translated, and so are sound names, categories and tags. The article text printed on the pages switches to French too. All translations are in `js/i18n.js` and `js/corpus.js`.

**Dark theme.** A sun/moon button in the top bar. It follows the device setting the first time and remembers your choice.

**Every device.** The layout adapts from small phones to wide desktop screens (single column, larger touch buttons, no sideways scrolling, 16 px inputs so iOS doesn't zoom, full-screen sound library on phones, landscape-phone layout).

**Works offline (PWA).** `manifest.webmanifest` and `sw.js` make the app installable and usable without internet after the first visit. The service worker saves the app files, sounds and icons at install, and fonts, stock photos and scans the first time they load.

**Fast export.** In browsers with WebCodecs (Chrome, Edge, recent Safari), frames are encoded with H.264 and AAC (or Opus) and written to an MP4 with the bundled `mp4-muxer` (MIT licence), so a 12-second video finishes in a few seconds. Other browsers fall back to real-time recording.

**Recorded sounds.** `sounds/` holds 10 short clips cut from CC0, public-domain and CC BY recordings on Wikimedia Commons (camera shutters, a page turn, a typewriter bell and more), with `manifest.json` and `CREDITS.md`. To add your own, put an MP3 in the folder and add an entry to `manifest.json`.

**My work and share links.** Projects (text, photos, settings) and the last 12 videos are kept in the browser (IndexedDB). "Copy link" stores your text and settings in the link itself. A bilingual `how.html` explains everything.

**Export.** 9:16, 4:5, 1:1 and 16:9 at 720p or 1080p. Output is MP4 in Chrome, Edge and Safari, and WebM in Firefox. You can batch-export several versions and share from a phone.

## Notes

- Pages are pre-rendered in the background after each change, so playback and export stay smooth.
- Video is recorded in real time. Keep the tab visible while exporting.
- Fonts load from Google Fonts.

## Files

- `index.html`, `css/app.css`: interface
- `js/corpus.js`: the article text used on the pages
- `js/paper.js`: close-up print renderer (publications, shots, photos, front page, depth of field)
- `js/templates.js`: the 34 newspaper / magazine / web / poster / object frames and the camera
- `how.html`, `css/how.css`: the How it works page
- `sw.js`, `manifest.webmanifest`, `icons/`: offline and install
- `js/fastexport.js`, `js/vendor/mp4-muxer.min.js`: fast MP4 export
- `js/store.js`: projects, video history, share links
- `sounds/`: recorded sounds, manifest and credits
- `js/i18n.js`: English/French translations
- `js/stock.js`: filler photos from Unsplash with generated fallbacks
- `js/audio.js`: foley and sound effect synthesis, music, WAV rendering, beat and drop detection
- `js/sounds.js`: sound library window
- `js/matchcut.js`: timeline, playback, pre-rendering, export, controls
- `js/recorder.js`: canvas + audio video recorder
- `js/util.js`, `js/app.js`: helpers and startup

## Deploy to Vercel

This is a static site with no build step. In Vercel: **Add New → Project → import this repository**, set **Framework Preset: Other**, leave the build command and output directory empty, and deploy. `vercel.json` sets the cache headers. When you change files, raise `VERSION` at the top of `sw.js` so visitors get the update.

## Licences

- Recorded sounds in `sounds/`: see `sounds/CREDITS.md` (CC0, public domain and CC BY).
- `js/vendor/mp4-muxer.min.js`: MIT, © Vanilagy.
- Stock photos are loaded from Unsplash and old newspaper scans from Wikimedia Commons (public domain) at runtime.
