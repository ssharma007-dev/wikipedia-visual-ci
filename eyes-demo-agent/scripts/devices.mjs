// Read the "Test on below devices:" list from a ticket ( markdown, as printed by eyes-demo-agent/scripts/jira.mjs fetch ) and turn it
// into Applitools Ultrafast Grid browsers for playwright.config.ts ( env EYES_DEVICES ).
//   node eyes-demo-agent/scripts/devices.mjs <ticket.md>   → prints the JSON list, or nothing when the ticket lists no devices
//
//   "Chrome desktop 1200×800", "Firefox 1280x720", "Safari", "Edge"   → desktop browser at that size ( default 1200×800 )
//   "iPhone 15", "iPad Air ( 5th generation )"                         → iOS device
//   anything else, e.g. "Galaxy S25 Ultra", "Pixel 7"                  → mobile device emulated in Chrome
import fs from 'node:fs';

const text = fs.readFileSync(process.argv[2], 'utf-8').split('\n');
const start = text.findIndex((l) => /test (?:it )?on (?:the )?(?:below|these|following)?\s*devices?/i.test(l));
if (start < 0) process.exit(0);

const names = [];
for (const line of text.slice(start + 1)) {
  const t = line.trim();
  if (!t) { if (names.length) break; else continue; }
  const m = t.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
  if (!m) break;                                   // the list ends at the first line that is not a list item
  names.push(m[1].replace(/\s*\(.*?\)\s*$/, '').trim());
}

const browsers = names.map((name) => {
  const desktop = name.match(/^(chrome|firefox|safari|edge)\b/i);
  if (desktop) {
    const size = name.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);
    const id = { chrome: 'chrome', firefox: 'firefox', safari: 'safari', edge: 'edgechromium' }[desktop[1].toLowerCase()];
    return { name: id, width: size ? +size[1] : 1200, height: size ? +size[2] : 800 };
  }
  if (/^(iphone|ipad)\b/i.test(name)) return { iosDeviceInfo: { deviceName: name, screenOrientation: 'portrait' } };
  return { chromeEmulationInfo: { deviceName: name, screenOrientation: 'portrait' } };
});
if (browsers.length) console.log(JSON.stringify(browsers));
