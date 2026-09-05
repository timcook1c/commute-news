const listEl = document.getElementById("list");
const updatedEl = document.getElementById("updated");
const emptyStateEl = document.getElementById("empty-state");
const tabs = document.querySelectorAll(".tab");

const SCORE_KEYS = { personal: "personalScore", business: "businessScore", sport: "sportScore" };

let feed = null;
let activeTab = "personal";

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function itemHtml(it, scoreKey, tagClass) {
  const flagged = it[scoreKey] >= 70;
  return `
    <a class="item" href="${it.link}" target="_blank" rel="noopener">
      <div class="item-meta">
        <span class="item-source">${it.source}</span>
        <span>&middot;</span>
        <span>${timeAgo(it.publishedAt)}</span>
        ${flagged ? `<span class="tag ${tagClass}">${it.topic || "high signal"}</span>` : ""}
      </div>
      <h2>${it.title}</h2>
      ${it.snippet ? `<p>${it.snippet}</p>` : ""}
    </a>
  `;
}

// Groups items first by region (UK / International), then by topic tag within
// each region, ordered by that group's best score.
function groupForDisplay(items, scoreKey) {
  const regionOrder = ["UK", "International"];
  const byRegion = { UK: [], International: [] };
  items.forEach((it) => {
    const bucket = it.region === "UK" ? "UK" : "International";
    byRegion[bucket].push(it);
  });

  return regionOrder
    .filter((region) => byRegion[region].length)
    .map((region) => {
      const topicMap = new Map();
      byRegion[region].forEach((it) => {
        const key = it.topic || "other";
        if (!topicMap.has(key)) topicMap.set(key, []);
        topicMap.get(key).push(it);
      });
      const topics = [...topicMap.entries()]
        .map(([topic, arr]) => ({
          topic,
          items: arr.sort((a, b) => b[scoreKey] - a[scoreKey]),
          best: Math.max(...arr.map((i) => i[scoreKey])),
        }))
        .sort((a, b) => b.best - a.best);
      return { region, topics };
    });
}

function render() {
  if (!feed || !feed.items?.length) {
    listEl.hidden = true;
    emptyStateEl.hidden = false;
    return;
  }

  const scoreKey = SCORE_KEYS[activeTab];
  const tagClass = activeTab === "business" ? "business" : activeTab === "sport" ? "sport" : "personal";
  const items = feed.items.filter((it) => it[scoreKey] >= 30);

  if (!items.length) {
    listEl.hidden = true;
    emptyStateEl.hidden = false;
    emptyStateEl.textContent = "Nothing scored highly enough here yet — check back after the next refresh.";
    return;
  }

  listEl.hidden = false;
  emptyStateEl.hidden = true;

  const groups = groupForDisplay(items, scoreKey);

  listEl.innerHTML = groups
    .map(
      (g) => `
        <section class="region-group">
          <h3 class="region-heading">${g.region}</h3>
          ${g.topics
            .map(
              (t) => `
                <div class="topic-group">
                  <h4 class="topic-heading">${t.topic}</h4>
                  ${t.items.map((it) => itemHtml(it, scoreKey, tagClass)).join("")}
                </div>
              `
            )
            .join("")}
        </section>
      `
    )
    .join("");
}

function setActiveTab(tab) {
  activeTab = tab;
  tabs.forEach((btn) => btn.setAttribute("aria-selected", String(btn.dataset.tab === tab)));
  render();
}

tabs.forEach((btn) => btn.addEventListener("click", () => setActiveTab(btn.dataset.tab)));

async function loadFeed() {
  try {
    const res = await fetch("data/feed.json", { cache: "no-store" });
    feed = await res.json();
    updatedEl.textContent = feed.generatedAt ? `Updated ${timeAgo(feed.generatedAt)}` : "";
    render();
  } catch (err) {
    updatedEl.textContent = "Offline — showing last cached feed";
    render();
  }
}

loadFeed();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js");
  });
}
