import { nowSnapshot } from "../data/now.js";
import { renderNowList } from "../core/templates.js";

const learningEl = document.getElementById("now-learning");
const buildingEl = document.getElementById("now-building");
const thinkingEl = document.getElementById("now-thinking");
const updatedEl = document.getElementById("now-updated");

learningEl.innerHTML = renderNowList(nowSnapshot.learning);
buildingEl.innerHTML = renderNowList(nowSnapshot.building);
thinkingEl.innerHTML = renderNowList(nowSnapshot.thinking);
updatedEl.textContent = `Last updated: ${nowSnapshot.updatedAt}`;
