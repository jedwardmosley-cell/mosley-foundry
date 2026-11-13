// Builds the public website for Vercel (no packages needed).
//   site/index.html      the interactive demo with fictional sample data
//   site/app/index.html  a blank copy of ProcessIQ that saves in the visitor's browser
// Only these files are published; nothing else from the project goes on the site.
"use strict";
const fs = require("fs");
const path = require("path");

const here = __dirname;
// Output folder: given as an argument (relative to where the build runs), else ../site
const out = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.join(here, "..", "site");
const app = fs.readFileSync(path.join(here, "index.html"), "utf8");
const seed = JSON.parse(fs.readFileSync(path.join(here, "demo", "demo-seed.json"), "utf8"));

if (!app.includes("<title>ProcessIQ</title>") || !app.includes("<script>")) {
  throw new Error("ProcessIQ/index.html is not in the expected shape; site not built.");
}

// The demo is the same app with the sample data handed in before the app starts.
const seedJs = JSON.stringify(seed).replace(/<\//g, "<\\/");
const titled = app.replace("<title>ProcessIQ</title>", "<title>ProcessIQ Demo</title>");
const at = titled.indexOf("<script>");
const demo = titled.slice(0, at) +
  "<script>window.PROCESSIQ_DEMO = { seed: " + seedJs + " };</script>\n" +
  titled.slice(at);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "app"), { recursive: true });
fs.writeFileSync(path.join(out, "index.html"), demo);
fs.writeFileSync(path.join(out, "app", "index.html"), app);
console.log("Built site/index.html (demo) and site/app/index.html (blank app).");
