import { nowSnapshot } from "../data/now.js";
import { nowSnapshotZh } from "../data/zh/now.js";
import { renderNowList } from "../core/templates.js";
import { getPageLocale } from "../core/locale.js";

const locale = getPageLocale();
const snapshot = locale === "zh" ? nowSnapshotZh : nowSnapshot;
const learningEl = document.getElementById("now-learning");
const buildingEl = document.getElementById("now-building");
const thinkingEl = document.getElementById("now-thinking");
const updatedEl = document.getElementById("now-updated");

learningEl.innerHTML = renderNowList(snapshot.learning);
buildingEl.innerHTML = renderNowList(snapshot.building);
thinkingEl.innerHTML = renderNowList(snapshot.thinking);
updatedEl.textContent = locale === "zh" ? `最后更新：${snapshot.updatedAt}` : `Last updated: ${snapshot.updatedAt}`;
