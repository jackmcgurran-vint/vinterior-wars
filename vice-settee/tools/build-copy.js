#!/usr/bin/env node
// Regenerates vice-settee/COPY.md from the game itself, so the copy deck never
// drifts from what players see. Run from the repo root:
//   node vice-settee/tools/build-copy.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.join(__dirname, '..', 'index.html');
const OUT = path.join(__dirname, '..', 'COPY.md');
const html = fs.readFileSync(GAME, 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

/* ---------- run the game headless to read its data tables ---------- */

const el = () => ({
  innerHTML: '', textContent: '', className: '', value: '', style: {}, max: 0, disabled: false,
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  addEventListener() {}, removeEventListener() {}, focus() {}, select() {}, prepend() {},
  remove() {}, click() {}, querySelector: () => el(),
});
const sb = {
  Math, Date, JSON, console,
  document: { getElementById: () => el(), createElement: el, addEventListener() {}, removeEventListener() {},
    body: { classList: { add() {}, remove() {}, toggle() {} } } },
  localStorage: { getItem: () => null, setItem() {} },
  matchMedia: () => ({ matches: false }), navigator: {},
  location: { href: 'https://example.test/vice-settee/', origin: 'https://example.test' },
};
sb.window = sb;
vm.createContext(sb);
const names = ['CITIES', 'SPIKES', 'CRASHES', 'DJ_STORY', 'DJ_LINES', 'LISTENER_TEXTS', 'ADVERTS', 'SCANNER_LINES',
  'DAMAGE', 'JOBS', 'JOB_DONE_LINES', 'JOB_MISSED_LINES', 'SCENES', 'VERDICTS', 'ITEMS', 'ENC_DEFS', 'ITEM_LINKS',
  'DAYS', 'START_DEBT', 'START_CASH', 'START_CAP', 'INTEREST', 'MIAMI_FARE', 'SACK_TRUCK_PRICE', 'COLLECTOR_DEBT',
  'fmt', 'rankFor'];
const fnNames = (code.match(/^(?:async )?function [A-Za-z0-9_]+/gm) || []).map(s => s.replace(/^(?:async )?function /, ''));
vm.runInContext(code + `;globalThis.__copy = { ${names.join(', ')}, fns: { ${fnNames.join(', ')} } };`, sb);
const G = sb.__copy;

/* ---------- pull string literals out of a function's source ---------- */

const CONSTS = {
  'fmt(START_DEBT)': G.fmt(G.START_DEBT), 'fmt(START_CASH)': G.fmt(G.START_CASH),
  'fmt(MIAMI_FARE)': G.fmt(G.MIAMI_FARE), 'fmt(SACK_TRUCK_PRICE)': G.fmt(G.SACK_TRUCK_PRICE),
  'START_CAP': String(G.START_CAP), 'DAYS': String(G.DAYS), 'Math.round(INTEREST * 100)': String(Math.round(G.INTEREST * 100)),
};

// turn a ${...} expression into a readable placeholder
function placeholder(expr) {
  const e = expr.trim();
  if (CONSTS[e]) return CONSTS[e];
  if (/took\.join/.test(e)) return '{the stock they take}';
  if (/S\.debt > 0/.test(e)) return '[Still owing {£ amount}. / Loan cleared. Uncle Barry buys YOU a chip.]';
  if (/fav \?/.test(e)) return '[, favourite item: {item}]';
  if (/toLocaleString/.test(e)) return '{n}';
  if (/rank/.test(e)) return '{rank}';
  if (/\.when/.test(e)) return '{date}';
  if (/=== 1 \? '' : 's'/.test(e)) return '(s)';
  if (/^(st|lt)\.\w+$/.test(e)) return '{n}';
  const inner = stringsIn(e).filter(x => x.trim());
  if (inner.length) return (inner[0].startsWith(' ') ? ' ' : '') + '[' + inner.map(x => x.trim()).join(' / ') + ']';
  if (/^fmt\(/.test(e)) return '{£ amount}';
  if (/(^|\.)(name|item|selMarket|selVan)$/.test(e) || /\.item$/.test(e)) return '{item}';
  if (/(^|\.)(qty|lost|n|max)$/.test(e)) return '{n}';
  if (/(^|\.)(city|dest)$/.test(e)) return '{city}';
  if (/deadline|S\.day/.test(e)) return '{day}';
  if (/S\.cap/.test(e)) return '{slots}';
  if (/took\.join/.test(e)) return '{the stock they take}';
  if (/onPoster|piece/.test(e)) return '{piece}';
  if (/escHtml\(val\)/.test(e)) return '{what the player typed}';
  if (/url/.test(e)) return '{game link}';
  return '{' + e + '}';
}

// a tiny tokenizer: returns the string literals in a chunk of JS, with
// template expressions replaced by placeholders
function stringsIn(src) {
  const out = [];
  let i = 0;
  const readTemplate = () => {
    let s = '';
    i++; // opening backtick
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { s += unescape(src.slice(i, i + 6)); i += src[i + 1] === 'u' ? 6 : 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        let depth = 1, start = i;
        while (i < src.length && depth) {
          const c = src[i];
          if (c === '`') { readTemplate(); continue; }
          if (c === "'" || c === '"') { readQuoted(c); continue; }
          if (c === '{') depth++;
          if (c === '}') depth--;
          i++;
        }
        s += placeholder(src.slice(start, i - 1));
        continue;
      }
      s += src[i++];
    }
    i++; // closing backtick
    return s;
  };
  const readQuoted = (q) => {
    let s = '';
    i++;
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') { s += unescape(src.slice(i, i + 6)); i += src[i + 1] === 'u' ? 6 : 2; continue; }
      s += src[i++];
    }
    i++;
    return s;
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
    if (c === '`') { out.push(readTemplate()); continue; }
    if (c === "'" || c === '"') { out.push(readQuoted(c)); continue; }
    i++;
  }
  return out;
}

function unescape(seq) {
  if (seq[1] === 'u') return String.fromCharCode(parseInt(seq.slice(2, 6), 16));
  return { n: '\n', t: '\t' }[seq[1]] ?? seq[1];
}

// strip markup and keep only things that read as copy
function tidy(s) {
  return s.replace(/\{[A-Za-z]+\(\)\}/g, '').replace(/<br\s*\/?>/g, '\n').replace(/<\/?(li|p|div|h2|ul)[^>]*>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').split('\n').map(l => l.trim()).join('\n').trim();
}
function isCopy(s) {
  const t = tidy(s);
  if (/<th[ >]/.test(s)) return false;
  return t.length >= 8 && /[a-z]{2,} [a-z]/i.test(t) && !/^(url|data:|#|\.|rgba?\(|translate|<)/.test(t)
    && !/[{;]\s*$/.test(t) && !/\b(px|stroke|viewBox|onclick|class=)\b/.test(t);
}
function copyFrom(...fns) {
  const seen = new Set();
  const out = [];
  for (const f of fns) {
    for (const s of stringsIn(G.fns[f].toString())) {
      const t = tidy(s);
      if (isCopy(s) && !seen.has(t)) { seen.add(t); out.push(t); }
    }
  }
  return out;
}

// screens built by concatenating many strings: keep markup and prose, drop
// code strings (ids, event names, media queries) and the window title
function joinedCopy(fn, drop = []) {
  return tidy(stringsIn(G.fns[fn].toString())
    .filter(x => (x.includes('<') || / /.test(x)) && !/^\{.*\}$/.test(x) && !/^\(.*\)$/.test(x) && !drop.includes(x))
    .join(''));
}

/* ---------- write the markdown ---------- */

const md = [];
const h = (level, text) => md.push('', '#'.repeat(level) + ' ' + text, '');
const p = (text) => md.push(text, '');
const ul = (items) => { items.forEach(t => md.push('- ' + t.replace(/\n+/g, ' ')),); md.push(''); };
const quote = (t) => { t.split('\n').forEach(l => md.push(l ? '> ' + l : '>')); md.push(''); };

md.push('# Vinterior Wars: Vice Settee: the copy deck');
p(`Every line of player-facing copy in [index.html](index.html), generated from the game itself by ` +
  '`node vice-settee/tools/build-copy.js`. **Edit the game, then rerun the script.** Do not edit this file by hand; it will be overwritten.');

h(2, 'Context');
ul([
  `**What it is.** A Windows 98-style trading game in the spirit of the 1980s classic Dope Wars, rethemed as vintage furniture dealing. The player has ${G.DAYS} days to turn Uncle Barry's ${G.fmt(G.START_DEBT)} loan (${Math.round(G.INTEREST * 100)}% a day) into as much as possible, trading across seven cities. It is Vinterior's public edition for GTA VI launch week (19 November 2026).`,
  '**Tone.** Caper, not crime: Lovejoy and Only Fools and Horses, never guns, drugs, violence or injuries. The writing borrows the *techniques* of the 2D GTA games (a radio station falling apart on air, deadpan fake adverts, shouty pager-style messages, characters who insult you with affection) but copies none of their lines.',
  '**IP rules.** "Vice Settee" is the only nod to GTA in the naming. No GTA names, places, characters, radio stations, logos, fonts, the WASTED/BUSTED/MISSION PASSED screens or the wanted star.',
  '**House style.** British English, £ with en-GB formatting, negative money as -£3,000, and no em-dashes in anything a player reads.',
  '**Placeholders.** `{item}`, `{n}`, `{city}`, `{day}`, `{slots}` and `{£ amount}` are filled in by the game at the time. Text in `[square brackets]` only appears in some cases (for example, if a fine applied).',
  '**Status.** Sandrine (Vinterior\'s founder) appears as herself in the calls, jobs and verdicts. **None of her lines are approved yet**, and the portraits are placeholders. The approval doc is the [Sandrine calls and cutscenes doc](https://claude.ai/code/artifact/36e95a94-2d57-4ed1-8f2c-e7d35294d07d).',
]);

h(2, 'Cast');
p('| Character | Role | Voice |\n| --- | --- | --- |\n' +
  '| Sandrine | The boss. Rings with delivery jobs and gives the final verdict. Always on the legitimate side. Real person, pending her approval. | Cutting, confident, never wrong. Treats the player as a promising idiot. Never crude. |\n' +
  '| Uncle Barry | Lent the player the money. Fictional. | London geezer. Calls you "son". Friendly in a way that worries you. |\n' +
  '| Barry\'s lads | Collect the debt once it passes ' + G.fmt(G.COLLECTOR_DEBT) + '. Fictional. | Few words, many chips. |\n' +
  '| Marlene | Rival dealer from the auction rooms. Fictional. | Territorial, calls you "sunshine", has been here since decimalisation. |\n' +
  '| The traffic warden | Recurring nuisance. Fictional. | Mostly silent. Photographs from artistic angles. |\n' +
  '| Clive Mahogany | Teak FM\'s breakfast DJ. Fictional. | Falling apart on air across the month. |\n' +
  '| Dawn and Gary | Clive\'s producers. Dawn quits; Gary is a sideboard. Fictional. | Neither speaks. |');

h(2, 'Title card and opening');
p('Shown once on load, over pixel art of an 80s sunset. The title reads VINTERIOR WARS / VICE SETTEE.');
quote(joinedCopy('showTitleCard'));
p('**Opening call** (Chapter 1). Sandrine\'s call opens the game after the title card.');
const intro = copyFrom('showIntro');
const firstLine = intro.findIndex(t => t.startsWith('SANDRINE:'));
quote(intro.slice(firstLine).join('\n\n'));
p('Around the call (setting line, caption, title, button):');
ul(intro.slice(0, firstLine));
p('**Help screen** (from the Help menu).');
quote(joinedCopy('showHelp', ['How to play']));
p('**First lines of the log.**');
copyFrom('newGame').forEach(t => quote(t));

h(2, 'Sandrine\'s jobs');
p('A payphone rings on set days with an optional delivery job. Arriving in the destination with the goods hands them over for the market price plus a bonus. Missing the deadline only loses the bonus. Bonuses and deadlines are still placeholders until balance testing is finished.');
p('| # | Rings on day | Job | Bonus |\n| --- | --- | --- | --- |\n' +
  G.JOBS.map((j, i) => `| ${i + 1} | ${j.ring} | ${j.qty} × ${j.item} to ${j.dest} by day ${j.deadline} | ${G.fmt(j.bonus)} |`).join('\n'));
G.JOBS.forEach((j, i) => { p(`**Job ${i + 1}**`); quote('SANDRINE: ' + j.brief); });
p('**On delivery** (one picked at random):');
ul(G.JOB_DONE_LINES);
p('**On a missed deadline** (one picked at random):');
ul(G.JOB_MISSED_LINES);
p('**Payphone and job messages:**');
ul(copyFrom('ringPhone', 'jobArrival'));

h(2, 'Cutscenes');
G.SCENES.forEach(sc => { p(`**${sc.title}** (day ${sc.day})`); quote(`*${sc.setting}*\n\n` + sc.lines.join('\n\n')); });

h(2, 'Final verdict and end screen');
p('Sandrine\'s verdict, chosen by the player\'s rank, opens the end screen.');
const rankBands = [[-1, 'Below £0'], [0, '£0 to £4,999'], [5000, '£5,000 to £19,999'], [20000, '£20,000 to £49,999'], [50000, '£50,000 to £149,999'], [150000, '£150,000 or more']];
p('| Final net worth | Rank | Sandrine says |\n| --- | --- | --- |\n' +
  rankBands.map(([v, band]) => { const r = G.rankFor(v); return `| ${band} | ${r} | ${G.VERDICTS[r] || ''} |`; }).join('\n'));
p('**End screen:**');
ul(copyFrom('showEndDialog', 'endGame'));
const statRows = [...G.fns.statsHtml.toString().matchAll(/\['([^']+)',/g)].map(m => m[1]);
p('**Stats table labels:** ' + statRows.join(' · '));
p('**Personal best and lifetime stats** (saved on the player\'s device only):');
ul(copyFrom('bestHtml', 'lifetimeHtml'));
p('**Share text** (Web Share API, or copied to the clipboard):');
ul(copyFrom('shareText', 'shareScore'));

h(2, 'Cities');
p('Each city\'s line appears in the log on arrival, alongside a big city-name card.');
p('| City | Arrival line |\n| --- | --- |\n' + G.CITIES.map(c => `| ${c.name} | ${c.blurb} |`).join('\n'));
p('**Travel messages:**');
ul(copyFrom('travel', 'loseDay'));

h(2, 'Teak FM');
p('A scrolling ticker under the log. Each day it plays: that day\'s market headlines, then the current beat of Clive\'s story, one standalone DJ line, then either an advert (odd days) or a listener text (even days). Police-scanner chatter joins once the player\'s heat reaches 2, and a warning line plays at heat 4.');
p('**Clive Mahogany\'s story.** Each beat plays for two days.');
p('| Days | Line |\n| --- | --- |\n' + G.DJ_STORY.map((l, i) => `| ${i * 2 + 1} to ${Math.min(G.DAYS, i * 2 + 2)} | ${l} |`).join('\n'));
p('**Standalone DJ lines:**'); ul(G.DJ_LINES);
p('**Listener texts:**'); ul(G.LISTENER_TEXTS);
p('**Adverts** (all products are invented):'); ul(G.ADVERTS);
p('**Police scanner** (heat 2 and above):'); ul(G.SCANNER_LINES);
p('**Market headlines.** One may fire on arrival, pushing a listed item\'s price up (spike) or down (crash). These also go to the log.');
p('Spikes:'); ul(G.SPIKES);
p('Crashes:'); ul(G.CRASHES);
p('**Other ticker lines:**'); ul(copyFrom('updateTicker'));

h(2, 'Encounters');
p('Random encounters on arrival, more likely at higher heat. The player picks from buttons that show the odds, for example "Run (62%)". Uncle Barry\'s lads only turn up once the debt passes ' + G.fmt(G.COLLECTOR_DEBT) + '.');
const enc = { demand: 1500, bribe: 160 };
p('| Encounter | Title | Opening line |\n| --- | --- | --- |\n' +
  Object.entries(G.ENC_DEFS).map(([k, d]) => `| ${k} | ${d.title} | ${tidy(d.intro(enc)).replace(G.fmt(1500), '{£ amount}')} |`).join('\n'));
p('**Buttons** (percentages are live odds; costs scale with the player\'s cash):');
ul(['Warden: Run (62%), Pay the ticket £160 (80%), Talk (65%)', 'Marlene and the heavies: Run (62%), Bribe £160 (80%), Talk (65%)', 'Barry\'s lads: Pay up, Hand over stock, Run (62%)']);
p('**Getting away clean** (by encounter, then by choice):'); ul(copyFrom('encounterSuccess'));
p('**When it goes wrong:**'); ul(copyFrom('encounterFailure'));
p('**Uncle Barry\'s lads** (pay up, hand over stock, or run):'); ul(copyFrom('resolveBarry'));

h(2, 'Random events');
p('At most one arrival event a day, unless an encounter, cutscene or call takes the slot.');
p('**Stock damage.** Damage only hits stock made of the matching material.');
p('| Material | Line |\n| --- | --- |\n' + G.DAMAGE.map(d => `| ${d.mat} | ${d.msg} |`).join('\n'));
p('**Other events:**');
ul(copyFrom('arrivalEvent', 'luckyFind', 'customsEvent', 'vanOffer', 'sackOffer', 'dresserOffer', 'tipEvent', 'tradeHeat'));

h(2, 'Trading, errors and system messages');
p('Blocking errors open a Windows 98 error box with a red ✕.');
ul(copyFrom('openBuy', 'openSell', 'openRepay', 'amtOk', 'showAmt', 'render', 'showBest'));

h(2, 'Cheat codes');
p('Typed on a desktop keyboard, or entered in a Windows-style Run box opened by tapping the title bar five times. Any cheat means the run won\'t count for a personal best.');
ul(copyFrom('applyCheat', 'cheatOk'));
const cheatSrc = code.match(/const CHEATS = \{([\s\S]*?)\n\};/)[1];
p('| Code | Effect |\n| --- | --- |\n' + [...cheatSrc.matchAll(/^\s*([A-Z]+):[\s\S]*?return '([^']+)'/gm)].map(m => `| ${m[1]} | ${m[2]} |`).join('\n'));

h(2, 'Items and links');
p('Each market row has a "Shop real ↗" link to a placeholder Vinterior search URL, with the campaign tracking codes (UTM) added. No real Vinterior prices appear anywhere.');
p('| Item | Material | Price range | Link |\n| --- | --- | --- | --- |\n' +
  G.ITEMS.map(it => `| ${it.name}${it.golden ? ' (cheat only)' : ''} | ${it.mats.join(', ')} | ${it.min === it.max ? G.fmt(it.min) + ' fixed' : G.fmt(it.min) + ' to ' + G.fmt(it.max)} | ${G.ITEM_LINKS[it.name] || '-'} |`).join('\n'));

h(2, 'For legal review');
ul([
  '"Vice Settee", the only nod to GTA.',
  'The Windows 98 imitation: window chrome, error boxes, and a Run box that says "Windows cannot find…".',
  'Brand and designer names in items: Ercol, Anglepoise, G Plan, Murano, Chesterfield (as a style), Eames (Herman Miller/Vitra), including the cheat-only Golden Eames Chair, Togo (Ligne Roset), and Memphis ("Memphis-Style Bookcase"; the fallback is "Postmodern Bookcase").',
  'Sandrine\'s name and likeness, pending her approval.',
  'Other real references: Persian rug, Marché aux Puces, Custard Cream, Calais, traffic wardens and the vehicle pound, and the city names.',
  'The invented brands in Teak FM adverts and listener texts, checked to make sure none clash with real businesses: ReclinaMax, Veneer Direct, Allen\'s Keys of Croydon, Nan\'s Credit, Pine Direct, Cushion+, TeakTone, SitRight, Doorframe Removals.',
  '"Desert Island Dovetails" parodies the title of a BBC programme.',
]);

fs.writeFileSync(OUT, md.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n');
console.log('wrote', path.relative(process.cwd(), OUT), (md.join('\n').length / 1024).toFixed(1) + ' KB');
