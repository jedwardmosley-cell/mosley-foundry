# ProcessIQ: Plan

ProcessIQ is a simple SIPOC process improvement app.

## What is a SIPOC?

A one-page, high-level map of a process, organized in five columns:

| Letter | Stands for | Question it answers |
|---|---|---|
| S | Suppliers | Who provides what the process needs? |
| I | Inputs | What materials, information or resources go in? |
| P | Process | What are the main steps? (usually 4 to 7) |
| O | Outputs | What does the process produce? |
| C | Customers | Who receives the outputs? |

## Version 1 features

- Name a process and fill in the five columns
- Add, edit and remove items in each column
- See the SIPOC as a clean, color-coded diagram
- Work is saved automatically in the browser
- Keep several SIPOCs and switch between them
- Print or save as PDF
- Export to a spreadsheet (CSV) file

## How it is built

- One single web page file: `index.html`
- Opens by double-clicking it; runs in any web browser
- No software to install, no account, no internet needed
- Data stays in the browser on the computer it is used on

## Steps

1. Create the folder and this plan (done)
2. Build a basic working version and review a screenshot (done)
3. Adjust based on feedback
4. Save each finished step to GitHub
5. Download to the Documents folder (done)

## Version 2: Process analysis (in progress)

- Stage 1: Step details, fact/hypothesis/question findings with approval, and Bottleneck analysis (done)
- Stage 2: 5 Whys root cause analysis (done)
- Stage 3: Automation opportunities and impact-versus-effort prioritization with action plan (done)
- Stage 4: "Ask Claude" buttons on the private page for bottleneck ideas, 5 Whys answers and automation ideas (uses the existing Claude account; no API key) (done)

## Version 3: Sync across devices

- SIPOCs sync through private per-user storage on the Claude page; each device still saves locally first (done)
- Backup button: copy all data as text, or restore it, to move work between the downloaded file and the private page (done)
