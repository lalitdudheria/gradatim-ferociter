async function loadWorkouts() {
  try {
    const res = await fetch("/api/workouts");
    if (!res.ok) throw new Error("Failed to load workouts");
    return await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function renderCalendar(workoutDates) {
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

    if (workoutDates.has(key)) {
      cell.classList.add("workout-done");
      const cross = document.createElement("span");
      cross.className = "workout-cross";
      cross.textContent = "✕";
      cross.setAttribute("aria-label", "Workout done");
      cell.appendChild(cross);
    }

    grid.appendChild(cell);
  }
}

(async function init() {
  const workouts = await loadWorkouts();
  const workoutDates = new Set(Array.isArray(workouts) ? workouts : []);
  renderCalendar(workoutDates);
})();
