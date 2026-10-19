# Vehicle Terminal

A Bloomberg-style terminal for used cars (Greenville, SC; ~$60k budget). Compares the BMW i8 with 10 other cars: sold and asking prices, a deal checker, recalls, news, sentiment, how each car is built (repair risk), and a buyer guide.

**Live site:** https://officialtouch.github.io/VehicleTerminal/

Keys: F1 Prices, F2 News & recalls, F3 Buyer guide, F4 Cars at $60k. The car, compare car and filters are saved in the page link, so you can bookmark a view.

## What's in here
- `index.html`: the whole page (layout, styles, logic). Edit this to change how it looks.
- `shim.js`: loads `data/*.json` and gives the page the data and filter functions it was written for.
- `data/`: the six datasets (see `CLAUDE.md` for what each holds) and `manifest.json`.
- `lib/d3.min.js`: charts library, bundled so the site has no outside dependencies.
- `tools/merge.py`: merges newly researched cars or listings into `data/`.
- `dev.js`, `worker/`, `.github/workflows/terminal.yml`, `tools/finish.py`: the developer login and the REFRESH / ADD CAR job.
- `CLAUDE.md`: how Claude adds cars, refreshes prices and scores a dealer quote.

## Updating
On the site: tap **DEV LOGIN**, sign in, then **REFRESH ALL** (listings, sales, KBB values and news for every car) or type a car and tap **ADD**. The job runs on GitHub using your Claude plan and the site updates when it finishes (10–60 minutes).

Or ask Claude directly: `add <car>`, `refresh`, or `deal <car> <year> <miles> <price>`. Claude edits `data/`, bumps `data/manifest.json` so phones reload the new data, and pushes. The site updates about a minute later.

## Caveats
- Sold prices are completed US auctions (Bring a Trailer, Cars & Bids and similar), not dealer sales. Dealer sale prices aren't public, so asking prices and KBB values stand in for retail.
- Thin data is flagged on the page (few sales in a year, or a car with under 8 sales has no deal checker).
- Listings change daily; refresh before relying on them.
