import { posts } from "../data/posts.js";
import { renderTopicButtons, renderWritingPosts } from "../core/templates.js";

const listEl = document.getElementById("post-list");
const chipEl = document.getElementById("topic-chips");

const topics = [...new Set(posts.map((p) => p.topic))];
const sorted = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));

let activeTopic = "";

function renderPosts() {
  const filtered = activeTopic ? sorted.filter((post) => post.topic === activeTopic) : sorted;
  listEl.innerHTML = renderWritingPosts(filtered);
}

chipEl.innerHTML = renderTopicButtons(topics, activeTopic);

chipEl.addEventListener("click", (event) => {
  const selectedButton = event.target.closest(".chip");
  if (!selectedButton) return;

  chipEl.querySelectorAll(".chip").forEach((button) => {
    const selected = button === selectedButton;
    button.classList[selected ? "add" : "remove"]("active");
    button.setAttribute("aria-pressed", String(selected));
  });
  activeTopic = selectedButton.dataset.topic;
  renderPosts();
});

renderPosts();
