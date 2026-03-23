import { nowSnapshot } from "../data/now.js";
import { escapeHtml } from "../site.js";

const learningEl = document.getElementById("now-learning");
const buildingEl = document.getElementById("now-building");
const thinkingEl = document.getElementById("now-thinking");
const updatedEl = document.getElementById("now-updated");

function toItems(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

learningEl.innerHTML = toItems(nowSnapshot.learning);
buildingEl.innerHTML = toItems(nowSnapshot.building);
thinkingEl.innerHTML = toItems(nowSnapshot.thinking);
updatedEl.textContent = `Last updated: ${nowSnapshot.updatedAt}`;
