const listEl = document.getElementById("list");
const updatedEl = document.getElementById("updated");
const emptyStateEl = document.getElementById("empty-state");
const tabs = document.querySelectorAll(".tab");

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

function render() {
  if (!feed || !feed.items?.length) {
    listEl.hidden = true;
    emptyStateEl.hidden = false;
    return;
  }
  listEl.hidden = false;
  emptyStateEl.hidden = true;

  const scoreKey = activeTab === "personal" ? "personalScore" : "businessScore";
  const items = [...feed.items]
    .filter((it) => it[scoreKey] >= 30)
    .sort((a, b) => b[scoreKey] - a[scoreKey]);

  listEl.innerHTML = items
    .map((it) => {
      const flagged = it[scoreKey] >= 70;
      const tagClass = activeTab === "personal" ? "personal" : "business";
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
    })
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
    updatedEl.textContent = feed.generatedAt
      ? `Updated ${timeAgo(feed.generatedAt)}`
      : "";
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
