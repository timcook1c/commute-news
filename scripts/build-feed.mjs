import fs from "node:fs/promises";
import { fetchAllItems } from "./fetch-sources.mjs";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.SCORING_MODEL || "claude-haiku-4-5-20251001";
const BATCH_SIZE = 20;
const MAX_ITEMS_OUT = 150;

if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY env var.");
  process.exit(1);
}

async function loadProfile() {
  const raw = await fs.readFile(new URL("../profile.json", import.meta.url), "utf-8");
  return JSON.parse(raw);
}

function buildPrompt(profile, batch) {
  return `You are scoring news headlines for one specific reader, for a commute reading app. Score each item on two 0-100 scales:

- personal_score: how relevant to this reader's personal interests: ${profile.personal_interests.join("; ")}
- business_score: how relevant to these business/market signals: ${profile.business_signals.join("; ")}

Score 0 if not relevant at all. Score 80+ only for genuinely important, high-signal stories (not routine coverage). Also assign one short topic tag (2-3 words, lowercase, e.g. "private equity", "oil prices", "consumer retail", "global crisis", "general world news").

Return ONLY a JSON array, no prose, no markdown fences, one object per input item in the same order:
[{"personal_score": 0, "business_score": 0, "topic": "..."}]

Items:
${batch.map((it, i) => `${i + 1}. [${it.source}] ${it.title} — ${it.snippet}`).join("\n")}`;
}

async function scoreBatch(profile, batch) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: buildPrompt(profile, batch) }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

  let scores;
  try {
    scores = JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse scoring response, skipping batch:", text.slice(0, 300));
    return batch.map(() => ({ personal_score: 0, business_score: 0, topic: "unscored" }));
  }
  return scores;
}

async function main() {
  console.log("Fetching sources...");
  const { items, errors } = await fetchAllItems({ maxAgeHours: 48 });
  console.log(`Fetched ${items.length} items, ${errors.length} source errors.`);
  if (errors.length) {
    for (const e of errors) console.warn(`  source failed: ${e.source} (${e.error})`);
  }

  if (items.length === 0) {
    console.error("No items fetched — aborting so we don't overwrite feed.json with nothing.");
    process.exit(1);
  }

  const profile = await loadProfile();

  console.log("Scoring with Claude...");
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const scores = await scoreBatch(profile, batch);
    batch.forEach((item, j) => {
      const s = scores[j] || { personal_score: 0, business_score: 0, topic: "unscored" };
      item.personalScore = s.personal_score ?? 0;
      item.businessScore = s.business_score ?? 0;
      item.topic = s.topic || "unscored";
    });
    console.log(`  scored ${Math.min(i + BATCH_SIZE, items.length)}/${items.length}`);
  }

  // Keep the top items by whichever score is higher, so the feed stays a manageable
  // size for offline caching on a phone.
  const ranked = items
    .sort((a, b) => Math.max(b.personalScore, b.businessScore) - Math.max(a.personalScore, a.businessScore))
    .slice(0, MAX_ITEMS_OUT);

  const feed = {
    generatedAt: new Date().toISOString(),
    itemCount: ranked.length,
    items: ranked,
  };

  await fs.mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await fs.writeFile(new URL("../data/feed.json", import.meta.url), JSON.stringify(feed, null, 2));
  console.log(`Wrote data/feed.json with ${ranked.length} items.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
