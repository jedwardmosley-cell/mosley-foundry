# Both Hands on the Wheel

A personal leadership and coaching platform created by Jason Mosley, Mosley Foundry.
**Lead yourself. Develop others. Build a life by design.**

FORGE provides the development principles. Discipline by Design creates the accountability system. The pathways (Personal Leadership, Leading Others, Entrepreneurial Leadership) provide practical application. AI provides reinforcement. Human relationships stay at the center.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the architecture, data model, privacy rules, build phases, and the list of missing source materials and licensing decisions.

## Run it locally

```bash
npm install
cp .env.example .env            # add ANTHROPIC_API_KEY to enable the AI Companion
npm run db:push && npm run db:seed
npm run dev                     # http://localhost:3000
```

Demo accounts (fictional people), password `demo-password-1`:
`dana@demo.bothhands.app` (participant), `marcus@demo.bothhands.app` (entrepreneur), `coach@demo.bothhands.app`, `admin@demo.bothhands.app`.

### Content pack

Book and workbook text is proprietary and is not committed. Without it the app runs on a clearly labeled draft fallback. To install it, export the manuscript and Personal Application Workbook to `manuscript.txt` and `workbook.txt` and run:

```bash
npm run content:build -- /path/to/folder src/content/licensed/pack.json
```

and place `entrepreneur.json` in `src/content/licensed/`.

## Tests

```bash
npm test                                         # scoring, cycle logic, authorization (needs seeded DB)
npm run build && PORT=3100 npm start &           # then:
BASE_URL=http://localhost:3100 npm run test:e2e  # full acceptance workflow in a browser
```
