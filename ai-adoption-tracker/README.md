# AI Adoption Follow-Through Tracker

Helps managers see whether the behaviors expected from an AI rollout are being **adopted**, **sustained**, and **producing measurable improvements**.

## How to open it

1. Download or copy this folder (`ai-adoption-tracker`) to your Mac.
2. Double-click `index.html`. It opens in Safari or Chrome.

You don't need to install anything, sign up for anything, or be online. The first time you open it, it shows fictional example data so you can explore. Use **Start with a blank tracker** when you're ready.

**On a phone:** the layout adapts to small screens. To open it on a phone, the folder needs to be hosted on a web address. A free option is GitHub Pages (Repository Settings > Pages). Data entered on the phone stays on the phone, so use Backup and Restore to move data between devices.

## What's in the folder

| File | What it does |
|---|---|
| `index.html` | The page itself |
| `styles.css` | The look and layout (light and dark mode, phone layout) |
| `app.js` | All the logic: rollouts, check-ins, flags, dashboard, review, import, export |
| `processiq-import-template.csv` | Blank template for importing ProcessIQ opportunities |
| `job-aid.html` | Two-page training reference. Open it and print, or save as PDF |

## Where your data lives

Everything is saved automatically in your browser, on that device only. Nothing is sent anywhere. Clearing browser history or site data can erase it, so use **Data > Download backup** regularly. The app reminds you every 14 days. **Restore** loads a backup file back in.

## The rules it uses

- **Completed week:** a week counts once a check-in is recorded, or once its date has passed without one.
- **Missed 2+ weeks (flagged):** the two most recent completed weeks were both reported *Not used*.
- **Check-in missing:** the most recent completed week has no check-in. Missing data is never counted as nonuse.
- **Partly used** shows as "Watch" and does not count toward the two-week flag.
- **Sustained:** *Used* three or more weeks in a row.
- **Progress to target:** how far the latest value has moved from baseline toward target. Works for measures that should go up or down.

## Importing from ProcessIQ

Use the CSV template (also downloadable inside the app on the Import page). Required columns are `opportunity_id` and `proposed_behavior`. Imported rows go into a queue, and each one becomes a behavior once you choose a rollout and confirm the details. ProcessIQ itself is not changed.
