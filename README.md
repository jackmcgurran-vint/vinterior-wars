# Vinterior Wars

A Windows 98-style trading game in the spirit of Dope Wars: buy vintage furniture cheap, haul it across Europe in your van, sell it dear, and repay Featherstone & Sons before the interest eats you alive. 30 days, six cities, one shot at becoming a Vinterior Legend.

**Play:** open `index.html` in any browser — no build, no dependencies.

## How to play

- You start in London with £2,000 cash, £5,000 of debt (6% interest a day) and a 20-slot van.
- Travelling to another city ends the day. Markets differ: teak is cheap in Copenhagen, Murano glass in Milan, Togo suites in Paris; Berlin is cheap across the board, London is dear.
- Debt can only be repaid in London.
- Watch the log: markets spike and crash, and stock can spoil in the van — woodworm eats wood, moths eat fabric, glass smashes on cobbles, leather moulds under a leaky roof.
- After 30 days you get your final net worth, a rank, and your run stats — then submit your score to the leaderboard.

## Setting up the shared leaderboard (one-off, ~5 minutes)

The game is a static page, so scores are stored via a tiny Google Apps Script web app attached to a Google Sheet you own.

1. Create a new Google Sheet (e.g. "Vinterior Wars Leaderboard") in your Google account.
2. In the Sheet: **Extensions → Apps Script**. Delete the default code, paste in the contents of `leaderboard.gs`, and save.
3. Click **Deploy → New deployment**, choose type **Web app**, and set:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
4. Click **Deploy** and authorise when prompted (it only asks for access to your spreadsheets).
5. Copy the **Web app URL** it gives you (ends in `/exec`).
6. In `index.html`, paste that URL into `LEADERBOARD_URL` near the top of the `<script>` section, and commit/push.

Every submission lands as a row in the Sheet (timestamp, name, score, verification code), and the game's **Leaderboard** menu shows the live top 10 (best score per person).

To update the script later: edit the code, then **Deploy → Manage deployments → ✏️ → New version** — the URL stays the same.

### Quick test once deployed

```bash
curl -L 'YOUR_WEB_APP_URL'   # should return {"ok":true,"top":[]}
```

## Anti-cheat (realistic expectations)

Submissions carry a verification code — a checksum of name + score that the Apps Script recomputes and rejects on mismatch. This stops casual tampering (editing the POST, making up a number), but the hashing logic ships in the public page source, so a determined player could forge a code. For an internal staff competition, sense-check the top scores against the Sheet's timestamps; anything superhuman submitted 30 seconds after page load will be obvious.

If the leaderboard is unreachable (or `LEADERBOARD_URL` is empty), the game saves the score locally and gives the player their code to email in instead. That contact address is `CONTACT_EMAIL` in `index.html` — change or remove it before publishing if you prefer.

## Files

- `index.html` — the whole game (vanilla HTML/CSS/JS, self-contained).
- `leaderboard.gs` — Google Apps Script backend for the shared leaderboard.
