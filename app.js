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

function openModal(dateKey, description) {
  document.getElementById("modal-date").textContent = formatDateLabel(dateKey);
  document.getElementById("modal-description").textContent = description;
  document.getElementById("workout-modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("workout-modal").classList.add("hidden");
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
      cell.addEventListener("click", () => openModal(key, description));
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(key, description);
        }
      });
    }

    grid.appendChild(cell);
  }
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

  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("workout-modal").addEventListener("click", (e) => {
    if (e.target.id === "workout-modal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

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

  const [manualWorkouts, whoopData] = await Promise.all([loadWorkouts(), loadWhoopData()]);

  currentWorkouts = mergeWorkouts(manualWorkouts, whoopData);
  renderCalendar();
  renderWhoopStats(whoopData);
})();
