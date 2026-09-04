import { loadSources } from "./fetch-sources.mjs";
import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000 });

const sources = await loadSources();
console.log(`Checking ${sources.length} sources...\n`);

for (const s of sources) {
  try {
    const feed = await parser.parseURL(s.url);
    console.log(`OK   ${s.name} — ${feed.items?.length ?? 0} items`);
  } catch (err) {
    console.log(`FAIL ${s.name} (${s.url}) — ${err.message}`);
  }
}
