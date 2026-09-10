const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

async function loadWorkouts() {
  try {
    const res = await fetch("workouts.json");
    if (!res.ok) throw new Error("Failed to load workouts");
    return await res.json();
  } catch (err) {
    console.error(err);
    return {};
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function formatDateLabel(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("default", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function openModal(title, body, { markdown = false } = {}) {
  document.getElementById("detail-title").textContent = title;

  const bodyEl = document.getElementById("detail-body");
  if (markdown) {
    bodyEl.innerHTML = marked.parse(body);
  } else {
    bodyEl.textContent = body;
  }

  document.getElementById("detail-modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("detail-modal").classList.add("hidden");
}

let viewYear;
let viewMonth;
let currentWorkouts = {};

const today = new Date();
const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

function renderCalendar() {
  document.getElementById("month-label").textContent = MONTH_NAMES[viewMonth];

  const grid = document.getElementById("days-grid");
  grid.innerHTML = "";

  DAY_NAMES.forEach((name) => {
    const el = document.createElement("div");
    el.className = "day-name";
    el.textContent = name;
    grid.appendChild(el);
  });

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "cell empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = toDateKey(viewYear, viewMonth, day);
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = day;
    if (key === todayKey) cell.classList.add("today");

    const description = currentWorkouts[key];
    if (description) {
      cell.classList.add("miss");
      cell.setAttribute("role", "button");
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("aria-label", `Workout done on ${key}: ${description}`);
      cell.addEventListener("click", () => openModal(formatDateLabel(key), description));
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(formatDateLabel(key), description);
        }
      });
    }

    grid.appendChild(cell);
  }
}

async function loadBlogPosts() {
  try {
    const res = await fetch("blog.json");
    if (!res.ok) throw new Error("Failed to load blog posts");
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

const DEFAULT_TITLE_HTML = "Gradatim<br>Ferociter";
const DEFAULT_SUBTITLE = "Step by step, ferociously";
let whoopConnected = false;

async function openBlogPost(post) {
  let content = "*Couldn't load this post.*";
  try {
    const res = await fetch(post.file);
    if (!res.ok) throw new Error("Failed to load post file");
    content = await res.text();
  } catch (err) {
    console.error(err);
  }

  document.getElementById("page-title").textContent = post.title;
  document.getElementById("page-subtitle").textContent = formatBlogDateFull(post.date);
  document.getElementById("whoop-stats").classList.add("hidden");
  document.getElementById("blog-post-body").innerHTML = marked.parse(content);

  document.getElementById("blog-list").classList.add("hidden");
  document.getElementById("blog-post").classList.remove("hidden");
}

function showBlogList() {
  document.getElementById("page-title").innerHTML = DEFAULT_TITLE_HTML;
  document.getElementById("page-subtitle").textContent = DEFAULT_SUBTITLE;
  document.getElementById("whoop-stats").classList.toggle("hidden", !whoopConnected);

  document.getElementById("blog-post").classList.add("hidden");
  document.getElementById("blog-list").classList.remove("hidden");
}

function formatBlogDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("default", {
    month: "short",
    day: "numeric",
  });
}

function formatBlogDateFull(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("default", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function renderBlog(posts) {
  const list = document.getElementById("blog-list");
  list.innerHTML = "";

  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "blog-empty";
    empty.textContent = "No posts yet.";
    list.appendChild(empty);
    return;
  }

  const sorted = [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const post of sorted) {
    const item = document.createElement("div");
    item.className = "post";
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");

    const main = document.createElement("div");
    const title = document.createElement("div");
    title.className = "post-title";
    title.textContent = post.title;
    main.appendChild(title);

    if (post.excerpt) {
      const excerpt = document.createElement("div");
      excerpt.className = "post-excerpt";
      excerpt.textContent = post.excerpt;
      main.appendChild(excerpt);
    }

    const date = document.createElement("div");
    date.className = "post-date";
    date.textContent = formatBlogDate(post.date);

    item.appendChild(main);
    item.appendChild(date);

    const open = () => openBlogPost(post);
    item.addEventListener("click", open);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    list.appendChild(item);
  }
}

function switchView(viewName) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${viewName}`).classList.add("active");

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("current", item.dataset.view === viewName);
  });

  showBlogList();
}

async function completeWhoopExchangeIfPresent() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return;

  // Strip the OAuth params from the URL right away so a refresh doesn't
  // resend an already-used code.
  history.replaceState({}, "", location.pathname);

  try {
    const res = await fetch("/api/whoop/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    });
    if (!res.ok) throw new Error("Exchange failed");
  } catch (err) {
    console.error("WHOOP connection failed:", err);
  }
}

async function loadWhoopData() {
  try {
    const res = await fetch("/api/whoop/data");
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

function mergeWorkouts(manual, whoopData) {
  const merged = { ...manual };
  if (whoopData && whoopData.connected && whoopData.workouts) {
    for (const [date, info] of Object.entries(whoopData.workouts)) {
      if (!merged[date]) {
        merged[date] = `${info.sport} — ${info.durationMinutes} min (via WHOOP)`;
      }
    }
  }
  return merged;
}

function renderWhoopStats(data) {
  if (!data || !data.connected) return;
  whoopConnected = true;

  document.getElementById("stat-recovery").textContent =
    data.recoveryScore != null ? `${Math.round(data.recoveryScore)}%` : "—";
  document.getElementById("stat-sleep").textContent =
    data.sleepPerformance != null ? `${Math.round(data.sleepPerformance)}%` : "—";
  document.getElementById("stat-hrv").textContent =
    data.hrv != null ? `${Math.round(data.hrv)}` : "—";
  document.getElementById("stat-rhr").textContent =
    data.restingHeartRate != null ? `${Math.round(data.restingHeartRate)}` : "—";

  document.getElementById("whoop-stats").classList.remove("hidden");
}

(async function init() {
  viewYear = today.getFullYear();
  viewMonth = today.getMonth();

  document.getElementById("detail-close").addEventListener("click", closeModal);
  document.getElementById("detail-modal").addEventListener("click", (e) => {
    if (e.target.id === "detail-modal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => switchView(item.dataset.view));
  });

  document.getElementById("blog-back").addEventListener("click", showBlogList);

  document.getElementById("prev-month").addEventListener("click", () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });

  await completeWhoopExchangeIfPresent();

  const [manualWorkouts, whoopData, blogPosts] = await Promise.all([
    loadWorkouts(),
    loadWhoopData(),
    loadBlogPosts(),
  ]);

  currentWorkouts = mergeWorkouts(manualWorkouts, whoopData);
  renderCalendar();
  renderWhoopStats(whoopData);
  renderBlog(blogPosts);
})();
