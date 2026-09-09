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

function renderCalendar(workouts) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  document.getElementById("month-label").textContent =
    now.toLocaleString("default", { month: "long", year: "numeric" });

  const grid = document.getElementById("days-grid");
  grid.innerHTML = "";

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toDateKey(year, month, now.getDate());

  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    grid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = toDateKey(year, month, day);
    const cell = document.createElement("div");
    cell.className = "day";
    if (key === todayKey) cell.classList.add("today");

    const number = document.createElement("span");
    number.className = "day-number";
    number.textContent = day;
    cell.appendChild(number);

    const description = workouts[key];
    if (description) {
      cell.classList.add("workout-done");
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

      const cross = document.createElement("span");
      cross.className = "workout-cross";
      cross.textContent = "✕";
      cell.appendChild(cross);
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

function renderWhoopBox(data) {
  if (!data || !data.connected) return;

  document.getElementById("whoop-recovery").textContent =
    data.recoveryScore != null ? `${Math.round(data.recoveryScore)}%` : "—";
  document.getElementById("whoop-sleep").textContent =
    data.sleepPerformance != null ? `${Math.round(data.sleepPerformance)}%` : "—";
  document.getElementById("whoop-hrv").textContent =
    data.hrv != null ? `${Math.round(data.hrv)}` : "—";
  document.getElementById("whoop-rhr").textContent =
    data.restingHeartRate != null ? `${Math.round(data.restingHeartRate)}` : "—";

  document.getElementById("whoop-box").classList.remove("hidden");
}

(async function init() {
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("workout-modal").addEventListener("click", (e) => {
    if (e.target.id === "workout-modal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  await completeWhoopExchangeIfPresent();

  const [manualWorkouts, whoopData] = await Promise.all([loadWorkouts(), loadWhoopData()]);

  renderCalendar(mergeWorkouts(manualWorkouts, whoopData));
  renderWhoopBox(whoopData);
})();
