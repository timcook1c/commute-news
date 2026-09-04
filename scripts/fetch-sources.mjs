import Parser from "rss-parser";
import fs from "node:fs/promises";

const parser = new Parser({ timeout: 15000 });

export async function loadSources() {
  const raw = await fs.readFile(new URL("../sources.json", import.meta.url), "utf-8");
  return JSON.parse(raw).sources;
}

function cleanText(s) {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// Loose de-dupe: same normalised headline seen from more than one source.
function dedupeKey(title) {
  return cleanText(title).toLowerCase().replace(/[^a-z0-9 ]/g, "").slice(0, 80);
}

export async function fetchAllItems({ maxAgeHours = 48 } = {}) {
  const sources = await loadSources();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
  const seen = new Map();
  const results = [];
  const errors = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const feed = await parser.parseURL(source.url);
        for (const item of feed.items || []) {
          const pub = item.isoDate || item.pubDate;
          const pubTime = pub ? new Date(pub).getTime() : Date.now();
          if (Number.isFinite(pubTime) && pubTime < cutoff) continue;

          const key = dedupeKey(item.title || "");
          if (!key) continue;

          if (seen.has(key)) {
            // Already have this story from another source — keep the first, note the extra source.
            const existing = results[seen.get(key)];
            if (existing && !existing.alsoReportedBy.includes(source.name)) {
              existing.alsoReportedBy.push(source.name);
            }
            continue;
          }

          seen.set(key, results.length);
          results.push({
            title: cleanText(item.title),
            link: item.link,
            source: source.name,
            sourceType: source.type,
            region: source.region,
            publishedAt: pub ? new Date(pubTime).toISOString() : null,
            snippet: cleanText(item.contentSnippet || item.summary || "").slice(0, 300),
            alsoReportedBy: [],
          });
        }
      } catch (err) {
        errors.push({ source: source.name, url: source.url, error: String(err.message || err) });
      }
    })
  );

  return { items: results, errors };
}
