# Vehicle Terminal: how it works

Static site (GitHub Pages, no build). Deployed from `main` at https://officialtouch.github.io/VehicleTerminal/. Owner: OfficialTouch. Keep replies short and plain.

Origin: a Claude Dashboard artifact. `index.html` still calls the dashboard's `dash` API (`dash.data`, `dash.calc`, `dash.onData`, `dash.params`, `dash.setParams`, `dash.colors`); `shim.js` re-implements it from `data/*.json`. Params (car, vs, body, years, dots) live in the URL hash. The page renders from data: **adding or refreshing a car means changing rows in `data/`, not the page.** Only touch `index.html` for a requested page change.

## Rules
- Keep `[hidden] { display:none !important; }` in the head CSS: `.i8 { display:grid }` otherwise shows hidden tabs (the dashboard host used to supply this rule). When testing, check what's on screen (computed `display`), not the `.hidden` property.
- Each inline `<script>` in `index.html` is wrapped in its own function; keep it that way (top-level `const` would clash).
- After ANY change to `data/`, bump `v` in `data/manifest.json` (and `updated`). After ANY change to `index.html` or `shim.js`, bump `?v=N` on the `shim.js` tag in `index.html`. Otherwise phones keep old copies.
- Commit as `OfficialTouch <abtouch01@gmail.com>`, end the message with `Co-Authored-By: Claude <noreply@anthropic.com>`. `git pull -q --rebase && git push -q`. Check deploy: `gh run list -L 3` (the `pages build and deployment` run for your commit must be `completed/success`).
- The shell has no internet except package registries and GitHub; research with WebFetch/WebSearch only. Test locally: `python3 -m http.server` in the repo and Playwright (Chromium is at /opt/pw-browsers/chromium; block fonts.googleapis.com). Check zero console errors, `#sale-table` rows > 0, F2 opens the News tab.
- Never invent numbers. Use "—" and note it in the car's `price_gaps` / `unknowns`.
- Token rules: never re-research profile text on a refresh; one research agent per 2 cars, each writing JSON files to disk, not into chat.

## Sites
- Readable: classic.com, oldcarsdata.com, truecar.com (VINs in links), autotrader.com (no city/VIN), carvana.com, kbb.com, repairpal.com, api.nhtsa.gov (flaky).
- Unreadable, skip: Bring a Trailer (direct), Cars & Bids pages, CarMax, CarGurus, eBay Motors, AutoTempest, Cars.com, Wikipedia (the user rejected it).

## Datasets (`data/<name>.json`, arrays of rows; every row has `car` = kebab-case id, the i8 is `i8`)
- `sold_sales`: {date, price, year, miles, location, body, venue, outlier, note, url, car}. Completed US auction sales only. A high bid with no sale is not a sale.
- `sold_yearly`: {year, sales, median, p25, p75, thin, car}. Computed by merge.py unless a source publishes medians for exactly the generation.
- `asking_listings`: {date, price, year, miles, location, seller, status:"For sale"|"Last asking", body, url, vin, sources, car}. Merged across sites by VIN, else year + price (within $300 or 1%) + miles (within 1,000).
- `events`: {id, date, label, detail, value:null, approx, url, car}. 3-6 per car: launch, generation change, end of production, record sale, 2021-22 used-car peak (https://www.wardsauto.com/news/used-vehicle-prices-remain-elevated/798585/).
- `kbb_values`: {car, year, trim, fair_price, private_party, basis, as_of, url}.
- `car_profiles`: one object per car: {id, name, years, vs_i8, recalls:[{campaign, filed, years, issue, url:"https://www.nhtsa.gov/recalls?nhtsaId=<id>"}], recall_note, headlines:[{date, title, outlet, url}] (4-8, newest first), sentiment_summary, sentiment:[{source, url, who, rating, gist}] (3-6), known_issues:[{item, cost, url}], build:{layout, rating:"Easy"|"Moderate"|"Hard"|"Very hard", summary, jobs:[{job, why, cost, url}]} (oil change first, then 3-5 jobs the layout makes costlier or easier; check claims such as "must drop the engine" against sources), best_picks:[{label, pick, why}] (2-3), model_years:[{years, changes, specs, recalls}], verdict, running_costs:[{item, per_year, basis, url}], big_repairs:[{item, cost, url}], warranty:[str], checklist:[{check, why}] (6-8), walk_away:[str], service (nearest qualified shop to Greenville SC), unknowns:[str], specs:{what_60k, hp, zero60, insurance (The Zebra avg), value_trend, risk}, price_gaps}
- Cars now: i8, porsche-911-997-2, porsche-cayman-gts-981, porsche-macan-gts, mercedes-g550, lexus-lx600, lotus-evora-400, lotus-elise, corvette-c8, audi-r8-v8, nissan-gtr.

## Commands
- `add <car> [years] [trim]`: pick id/name/years (ask one question only if the generation is ambiguous). Two agents write to `NEW/<id>/` (git-ignored scratch, outside the repo is fine): prices agent -> `sold_sales.json` (40-80 sales), `retail.json` (current listings from Classic.com, TrueCar, Autotrader, each with `source` and `vin`), `events.json`, `kbb.json`; profile agent -> `profile.json` incl. `build` (recalls via api.nhtsa.gov/recalls/recallsByVehicle?make=&model=&modelYear=, sentiment from owner ratings/forums/reviews; flag au7o.io costs as weak). Then `python3 tools/merge.py data NEW`, bump manifest, test, push. Tell the user: median sold, average ask, deal-checker sample size, repair difficulty, biggest caveat.
- `refresh [car|all]`: one agent per 2-3 cars writes `retail.json` (ALL current listings), `sold_sales.json` (only sales newer than the car's latest), `kbb.json`, and `news.json` = {headlines (4-8, newest first: keep still-relevant existing ones, add new, dedupe by url), recalls (the full current NHTSA list), recall_note}. merge.py replaces each car's "For sale" rows, turns vanished ones into "Last asking", appends new sales without duplicates, recomputes yearly medians. Report listings added/gone per car and any new median.
- `deal <car> <year> <miles> <price>`: answer in chat with the math below. No research.

## Deal checker (the `deal_model` calc in index.html)
Per car use auction sales since 2024 (all if fewer than 8), excluding outliers and sales with no miles. Fewer than 8: too few to price it; give KBB plus listings.
- Scale each price by latestYearMedian / saleYearMedian (non-thin years only).
- `ln(price) = mY + b*(miles-mx) + c*(year-myr) + yoff[year]`; b, c from least squares; clamp b to [-2e-5, 0], c to [-0.1, 0.3]; yoff = sum of that year's residuals / (count + 3); s = residual SD, min 0.05.
- pct = price/fair - 1: <= -10% Great deal; <= 0 Good; <= +10% Fair (normal dealer markup); <= +20% High, negotiate; above that Overpriced.
- Also report the typical range fair*e^+-s, a target of fair to fair*1.05, the KBB fair price for that year, how many similar listings (+-1 yr, +-20k mi) ask less, and a caution if miles are outside the sales' range.

## Site buttons (DEV LOGIN, REFRESH ALL, ADD CAR)
- `dev.js` logs in against the Cloudflare Worker `worker/worker.js` (https://vehicle-terminal-api.abtouch01.workers.dev, deployed by Cloudflare Workers Builds from the `worker/` folder on every push). Worker secrets, set in the Cloudflare dashboard: `DEV_USER`, `DEV_PASS`, `GH_TOKEN` (fine-grained GitHub token: this repo, Actions read/write). Sessions last 7 days; changing the password logs everyone out.
- The worker starts `.github/workflows/terminal.yml` (one job at a time). It installs Claude Code and runs it with the repo secret `CLAUDE_CODE_OAUTH_TOKEN` (the owner's Claude plan, from `claude setup-token`), model sonnet. Claude only writes `NEW/`; `tools/finish.py` then merges, refuses broken output, keeps old listings if a car's new listing count collapses, bumps the manifest and records `last_run` (shown in the dev bar). Only `data/` is committed.
- Worker tests: `node worker/test.mjs`. Run a job by hand: `gh api -X POST repos/OfficialTouch/VehicleTerminal/actions/workflows/terminal.yml/dispatches -f ref=main -f 'inputs[cmd]=refresh'`.

## Look
Bloomberg style: black, amber (`--amber`), yellow function keys (F1-F4 switch tabs; ignored while typing), blue panel title strips. Skin lives in the `.vt` CSS block at the top of `index.html`.
