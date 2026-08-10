/* ==========================================================================
   My Workout Tracker — main application logic
   ========================================================================== */

const APP_TITLE = "My Workout Tracker";

/* ---------- Global state ---------- */
let data = loadData();
let draft = loadDraft();
let currentMuscleGroup = null;
let currentEntry = null;                       // { exerciseId, exerciseName, muscleGroup, sets[] } being edited
let entryContext = { mode: "draft", editIndex: null, workoutId: null };
let viewingWorkoutId = null;
let stack = [];                                 // navigation stack: {id, title, onReturn}

/* ==========================================================================
   Small helpers
   ========================================================================== */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatDateHuman(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function setsSummaryString(sets) {
  if (!sets || sets.length === 0) return "No sets";
  return sets.map((s) => `${s.weight}kg × ${s.reps}`).join(", ");
}

function blankSet(n) {
  return { setNumber: n, weight: "", reps: "", rpe: "", completed: false };
}

function ensureDraft() {
  if (!draft) {
    draft = newDraft();
    saveDraft(draft);
  }
  return draft;
}

function findWorkout(id) {
  return data.workouts.find((w) => w.id === id);
}

/* ==========================================================================
   Navigation
   ========================================================================== */

function showScreenRaw(id, title) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.getElementById("topbarTitle").textContent = title;
  document.getElementById("backBtn").classList.toggle("hidden", stack.length <= 1);
  document.getElementById("main").scrollTop = 0;
  window.scrollTo(0, 0);
}

function pushScreen(id, title, onReturn) {
  stack.push({ id, title, onReturn });
  showScreenRaw(id, title);
}

function resetStackTo(id, title, onReturn) {
  stack = [{ id, title, onReturn }];
  showScreenRaw(id, title);
  if (onReturn) onReturn();
}

function goBack() {
  if (stack.length <= 1) return;
  stack.pop();
  const top = stack[stack.length - 1];
  showScreenRaw(top.id, top.title);
  if (top.onReturn) top.onReturn();
}

function popToScreen(id) {
  const idx = stack.findIndex((s) => s.id === id);
  if (idx >= 0) stack.length = idx + 1;
  const top = stack[stack.length - 1];
  showScreenRaw(top.id, top.title);
  if (top.onReturn) top.onReturn();
}

/* Return to the workout summary screen, collapsing any muscle/exercise/set
   screens pushed on top of it (used by "Add Another Exercise" flow). */
function backToSummary() {
  const idx = stack.findIndex((s) => s.id === "screen-workout-summary");
  if (idx >= 0) {
    stack.length = idx + 1;
    const top = stack[stack.length - 1];
    showScreenRaw(top.id, top.title);
    renderWorkoutSummary();
  } else {
    pushScreen("screen-workout-summary", "Finish Workout", renderWorkoutSummary);
    renderWorkoutSummary();
  }
}

function setActiveNav(name) {
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
}

function enterWorkoutFlow() {
  ensureDraft();
  setActiveNav("workout");
  if (draft.exercises.length > 0) {
    resetStackTo("screen-workout-summary", "Finish Workout", renderWorkoutSummary);
  } else {
    resetStackTo("screen-muscle", "Start Workout", renderMuscleScreen);
  }
}

/* ==========================================================================
   HOME
   ========================================================================== */

function renderHome() {
  const today = getTodayWorkouts(data);
  const exToday = today.reduce((s, w) => s + w.exercises.length, 0);
  const setsToday = today.reduce((s, w) => s + w.exercises.reduce((s2, e) => s2 + e.sets.length, 0), 0);
  document.getElementById("statExercisesToday").textContent = exToday;
  document.getElementById("statSetsToday").textContent = setsToday;

  const week = getWeekWorkouts(data);
  const weekSetsCount = week.reduce((s, w) => s + w.exercises.reduce((s2, e) => s2 + e.sets.length, 0), 0);
  const weekVolume = week.reduce((s, w) => s + w.exercises.reduce((s2, e) =>
    s2 + e.sets.reduce((s3, st) => s3 + (st.completed ? Number(st.weight) * Number(st.reps) : 0), 0), 0), 0);
  document.getElementById("weekWorkouts").textContent = week.length;
  document.getElementById("weekSets").textContent = weekSetsCount;
  document.getElementById("weekVolume").textContent = Math.round(weekVolume);

  const recent = getRecentWorkouts(data, 5);
  const listEl = document.getElementById("recentWorkoutsList");
  const empty = document.getElementById("homeEmptyState");
  if (recent.length === 0) {
    listEl.innerHTML = "";
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    listEl.innerHTML = recent.map(workoutCardHtml).join("");
    listEl.querySelectorAll(".workout-card").forEach((card) => {
      card.addEventListener("click", () => {
        setActiveNav("history");
        resetStackTo("screen-history", "History", renderHistoryList);
        openHistoryDetail(card.dataset.id);
      });
    });
  }
}

/* ==========================================================================
   WORKOUT FLOW: muscle group -> exercise list -> set entry -> summary
   ========================================================================== */

function renderMuscleScreen() {
  const grid = document.getElementById("muscleGrid");
  grid.innerHTML = MUSCLE_GROUPS.map((g) => {
    const count = getAllExercises(data).filter((e) => e.muscleGroup === g).length;
    return `<div class="muscle-tile" data-group="${g}">${g}<small>${count} exercises</small></div>`;
  }).join("");
  grid.querySelectorAll(".muscle-tile").forEach((tile) => {
    tile.addEventListener("click", () => {
      currentMuscleGroup = tile.dataset.group;
      pushScreen("screen-exercise-list", currentMuscleGroup, () => renderExerciseList(currentMuscleGroup));
      renderExerciseList(currentMuscleGroup);
    });
  });

  const banner = document.getElementById("draftBanner");
  if (draft && draft.exercises.length > 0) {
    banner.classList.remove("hidden");
    document.getElementById("draftBannerText").textContent =
      `Workout in progress • ${draft.exercises.length} exercise${draft.exercises.length === 1 ? "" : "s"}`;
  } else {
    banner.classList.add("hidden");
  }
}

function renderExerciseList(group) {
  document.getElementById("exerciseSearch").value = "";
  const exercises = getAllExercises(data)
    .filter((e) => e.muscleGroup === group)
    .sort((a, b) => a.name.localeCompare(b.name));
  renderExerciseRows(exercises);
}

function exerciseRowHtml(e) {
  return `<div class="exercise-row" data-id="${e.id}">
      <div>
        <div class="ex-name">${escapeHtml(e.name)}${e.custom ? '<span class="custom-tag">Custom</span>' : ""}</div>
        <div class="ex-group">${e.muscleGroup}</div>
      </div>
      <span class="chevron">›</span>
    </div>`;
}

function renderExerciseRows(list) {
  const container = document.getElementById("exerciseListContainer");
  if (list.length === 0) {
    container.innerHTML = `<p class="empty-state">No exercises found.</p>`;
    return;
  }
  container.innerHTML = list.map(exerciseRowHtml).join("");
  container.querySelectorAll(".exercise-row").forEach((row) => {
    row.addEventListener("click", () => {
      const ex = getAllExercises(data).find((x) => x.id === row.dataset.id);
      openSetEntry(ex, { mode: "draft", editIndex: null, workoutId: null });
    });
  });
}

function openSetEntry(exercise, context) {
  entryContext = context;
  let sourceSets;
  if (context.editIndex != null) {
    const source = context.mode === "draft"
      ? draft.exercises[context.editIndex]
      : findWorkout(context.workoutId).exercises[context.editIndex];
    sourceSets = source.sets.map((s) => ({ ...s }));
  } else {
    sourceSets = [blankSet(1)];
  }
  currentEntry = {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    muscleGroup: exercise.muscleGroup,
    sets: sourceSets
  };

  pushScreen("screen-set-entry", exercise.name, null);
  document.getElementById("setEntryExerciseName").textContent = exercise.name;
  document.getElementById("deleteExerciseBtn").textContent =
    context.editIndex == null ? "Cancel" : "Delete Exercise";

  renderProgressHint(exercise.id, context);
  renderSetRows();
}

function renderProgressHint(exerciseId, context) {
  const excludeId = context.mode === "history" ? context.workoutId : null;
  const history = getExerciseHistory(data, exerciseId, excludeId);
  const hint = document.getElementById("setEntryProgressHint");
  if (history.length === 0) {
    hint.innerHTML = "No previous data for this exercise yet.";
    return;
  }
  const last = history[0];
  const prev = history[1];
  hint.innerHTML = `<b>Last workout:</b> ${setsSummaryString(last.sets)} <span style="color:var(--text-muted)">(${formatDateHuman(last.date)})</span>` +
    (prev ? `<br><b>Previous:</b> ${setsSummaryString(prev.sets)} <span style="color:var(--text-muted)">(${formatDateHuman(prev.date)})</span>` : "");
}

function renderSetRows() {
  const container = document.getElementById("setRows");
  container.innerHTML = `
    <div class="set-row-labels"><span>#</span><span>Weight (kg)</span><span>Reps</span><span>RPE</span><span></span><span></span></div>
  ` + currentEntry.sets.map((s, i) => `
    <div class="set-row" data-index="${i}">
      <div class="set-num">${i + 1}</div>
      <input type="number" inputmode="decimal" step="0.5" min="0" class="set-weight" placeholder="kg" value="${s.weight === "" ? "" : s.weight}">
      <input type="number" inputmode="numeric" step="1" min="0" class="set-reps" placeholder="reps" value="${s.reps === "" ? "" : s.reps}">
      <input type="number" inputmode="numeric" step="1" min="0" max="10" class="set-rpe" placeholder="–" value="${s.rpe === "" || s.rpe == null ? "" : s.rpe}">
      <button type="button" class="set-check ${s.completed ? "checked" : ""}" aria-label="Mark set completed">✓</button>
      <button type="button" class="set-del" aria-label="Delete set">✕</button>
    </div>
  `).join("");

  container.querySelectorAll(".set-row").forEach((row) => {
    const i = Number(row.dataset.index);
    row.querySelector(".set-weight").addEventListener("input", (e) => { currentEntry.sets[i].weight = e.target.value; });
    row.querySelector(".set-reps").addEventListener("input", (e) => { currentEntry.sets[i].reps = e.target.value; });
    row.querySelector(".set-rpe").addEventListener("input", (e) => { currentEntry.sets[i].rpe = e.target.value; });
    row.querySelector(".set-check").addEventListener("click", () => {
      currentEntry.sets[i].completed = !currentEntry.sets[i].completed;
      renderSetRows();
    });
    row.querySelector(".set-del").addEventListener("click", () => {
      currentEntry.sets.splice(i, 1);
      if (currentEntry.sets.length === 0) currentEntry.sets.push(blankSet(1));
      currentEntry.sets.forEach((s, idx) => { s.setNumber = idx + 1; });
      renderSetRows();
    });
  });
}

function saveCurrentExerciseEntry() {
  const cleaned = currentEntry.sets.map((s, i) => ({
    setNumber: i + 1,
    weight: s.weight === "" ? 0 : Number(s.weight),
    reps: s.reps === "" ? 0 : Number(s.reps),
    rpe: s.rpe === "" || s.rpe == null ? null : Number(s.rpe),
    completed: !!s.completed
  }));

  const hasValidSet = cleaned.some((s) => s.reps > 0);
  if (!hasValidSet) {
    showToast("Enter reps for at least one set");
    return;
  }

  const exerciseEntry = {
    exerciseId: currentEntry.exerciseId,
    exerciseName: currentEntry.exerciseName,
    muscleGroup: currentEntry.muscleGroup,
    sets: cleaned
  };

  if (entryContext.mode === "draft") {
    exerciseEntry.pr = computePRs(data, exerciseEntry.exerciseId, cleaned, null);
    if (entryContext.editIndex != null) {
      draft.exercises[entryContext.editIndex] = exerciseEntry;
    } else {
      draft.exercises.push(exerciseEntry);
    }
    saveDraft(draft);
    const pr = exerciseEntry.pr;
    showToast(pr.weight || pr.reps || pr.volume ? "🔥 New personal record!" : "Exercise saved", pr.weight || pr.reps || pr.volume ? "pr" : "");
    backToSummary();
  } else {
    const w = findWorkout(entryContext.workoutId);
    exerciseEntry.pr = computePRs(data, exerciseEntry.exerciseId, cleaned, w.id);
    w.exercises[entryContext.editIndex] = exerciseEntry;
    saveData(data);
    const pr = exerciseEntry.pr;
    showToast(pr.weight || pr.reps || pr.volume ? "🔥 New personal record!" : "Changes saved", pr.weight || pr.reps || pr.volume ? "pr" : "");
    goBack();
  }
}

function deleteCurrentExerciseEntry() {
  if (entryContext.mode === "draft") {
    if (entryContext.editIndex != null) {
      confirmModal("Remove this exercise?", "It will be removed from the current workout.", { confirmLabel: "Remove", danger: true })
        .then((ok) => {
          if (!ok) return;
          draft.exercises.splice(entryContext.editIndex, 1);
          saveDraft(draft);
          backToSummary();
        });
    } else {
      goBack();
    }
  } else {
    confirmModal("Delete this exercise?", "This removes it and all its sets from the saved workout.", { confirmLabel: "Delete", danger: true })
      .then((ok) => {
        if (!ok) return;
        const w = findWorkout(entryContext.workoutId);
        w.exercises.splice(entryContext.editIndex, 1);
        if (w.exercises.length === 0) {
          data.workouts = data.workouts.filter((x) => x.id !== w.id);
          saveData(data);
          showToast("Workout deleted (no exercises left)");
          popToScreen("screen-history");
        } else {
          saveData(data);
          showToast("Exercise deleted");
          goBack();
        }
      });
  }
}

/* ---------- Workout summary ---------- */

function renderWorkoutSummary() {
  const list = document.getElementById("summaryExerciseList");
  if (!draft || draft.exercises.length === 0) {
    list.innerHTML = `<p class="empty-state">No exercises added yet. Tap "Add Another Exercise" to get started.</p>`;
  } else {
    list.innerHTML = draft.exercises.map(summaryCardHtml).join("");
  }
  wireSummaryCards();
}

function summaryCardHtml(ex, i) {
  const prBits = [];
  if (ex.pr) {
    if (ex.pr.weight) prBits.push("Weight");
    if (ex.pr.reps) prBits.push("Reps");
    if (ex.pr.volume) prBits.push("Volume");
  }
  return `<div class="summary-card" data-index="${i}">
    <div class="summary-card-top">
      <span class="ex-name">${escapeHtml(ex.exerciseName)}</span>
      ${prBits.length ? `<span class="pr-badge">PR · ${prBits.join("/")}</span>` : ""}
    </div>
    <div class="summary-sets">${setsSummaryString(ex.sets)}</div>
    <div class="summary-actions">
      <button class="btn btn-outline btn-sm edit-ex-btn">Edit</button>
      <button class="btn btn-danger btn-sm remove-ex-btn">Remove</button>
    </div>
  </div>`;
}

function wireSummaryCards() {
  document.querySelectorAll("#summaryExerciseList .edit-ex-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.closest(".summary-card").dataset.index);
      const ex = draft.exercises[i];
      openSetEntry({ id: ex.exerciseId, name: ex.exerciseName, muscleGroup: ex.muscleGroup }, { mode: "draft", editIndex: i, workoutId: null });
    });
  });
  document.querySelectorAll("#summaryExerciseList .remove-ex-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.closest(".summary-card").dataset.index);
      confirmModal("Remove exercise?", "This will remove it from the current workout.", { confirmLabel: "Remove", danger: true })
        .then((ok) => {
          if (!ok) return;
          draft.exercises.splice(i, 1);
          saveDraft(draft);
          renderWorkoutSummary();
        });
    });
  });
}

/* ==========================================================================
   HISTORY
   ========================================================================== */

function workoutCardHtml(w) {
  const muscles = [...new Set(w.exercises.map((e) => e.muscleGroup))].join(" + ");
  const lines = w.exercises.slice(0, 3).map((e) =>
    `<div class="workout-exercise-line"><b>${escapeHtml(e.exerciseName)}:</b> ${setsSummaryString(e.sets)}</div>`
  ).join("");
  const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0);
  return `<div class="workout-card" data-id="${w.id}">
    <div class="workout-card-top">
      <span class="workout-date">${formatDateHuman(w.date)}</span>
      <span class="workout-meta">${w.exercises.length} ex · ${totalSets} sets</span>
    </div>
    <div class="workout-muscles">${muscles}</div>
    ${lines}
  </div>`;
}

function renderHistoryList() {
  const listEl = document.getElementById("historyList");
  const empty = document.getElementById("historyEmptyState");
  const workouts = [...data.workouts].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  if (workouts.length === 0) {
    listEl.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  listEl.innerHTML = workouts.map(workoutCardHtml).join("");
  listEl.querySelectorAll(".workout-card").forEach((card) => {
    card.addEventListener("click", () => openHistoryDetail(card.dataset.id));
  });
}

function openHistoryDetail(workoutId) {
  const w = findWorkout(workoutId);
  if (!w) return;
  viewingWorkoutId = workoutId;
  pushScreen("screen-history-detail", formatDateHuman(w.date), () => renderHistoryDetail(workoutId));
  renderHistoryDetail(workoutId);
}

function detailExerciseHtml(ex, i) {
  const prBits = [];
  if (ex.pr) {
    if (ex.pr.weight) prBits.push("Weight");
    if (ex.pr.reps) prBits.push("Reps");
    if (ex.pr.volume) prBits.push("Volume");
  }
  return `<div class="detail-exercise" data-index="${i}">
    <div class="detail-exercise-top">
      <span class="ex-name" style="font-weight:800;">${escapeHtml(ex.exerciseName)}</span>
      ${prBits.length ? `<span class="pr-badge">PR · ${prBits.join("/")}</span>` : ""}
    </div>
    ${ex.sets.map((s, si) => `
      <div class="detail-set-line" data-set-index="${si}">
        <span class="set-values ${s.completed ? "" : "incomplete"}">Set ${si + 1} — ${s.weight}kg × ${s.reps}${s.rpe ? ` · RPE ${s.rpe}` : ""}</span>
        <button class="set-del del-set-btn" aria-label="Delete set">✕</button>
      </div>`).join("")}
    <div class="detail-set-actions">
      <button class="btn btn-outline btn-sm edit-detail-ex-btn">Edit Sets</button>
      <button class="btn btn-danger btn-sm del-detail-ex-btn">Delete Exercise</button>
    </div>
  </div>`;
}

function renderHistoryDetail(workoutId) {
  const w = findWorkout(workoutId);
  const container = document.getElementById("historyDetailContainer");
  if (!w) {
    container.innerHTML = `<p class="empty-state">Workout not found.</p>`;
    return;
  }
  const muscles = [...new Set(w.exercises.map((e) => e.muscleGroup))].join(" + ");
  container.innerHTML = `
    <div class="detail-header">
      <h2>${formatDateHuman(w.date)}</h2>
      <div class="detail-sub">${muscles} · ${w.duration || 0} min</div>
    </div>
    ${w.exercises.map(detailExerciseHtml).join("")}
    <button class="btn btn-danger btn-block" id="deleteWorkoutBtn" style="margin-top:8px;">Delete Complete Workout</button>
  `;

  document.getElementById("deleteWorkoutBtn").addEventListener("click", () => {
    confirmModal("Delete this workout?", "This will permanently delete the whole workout and all its sets.", { confirmLabel: "Delete", danger: true })
      .then((ok) => {
        if (!ok) return;
        data.workouts = data.workouts.filter((x) => x.id !== w.id);
        saveData(data);
        showToast("Workout deleted");
        popToScreen("screen-history");
      });
  });

  container.querySelectorAll(".edit-detail-ex-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.closest(".detail-exercise").dataset.index);
      const ex = w.exercises[i];
      openSetEntry({ id: ex.exerciseId, name: ex.exerciseName, muscleGroup: ex.muscleGroup }, { mode: "history", workoutId: w.id, editIndex: i });
    });
  });

  container.querySelectorAll(".del-detail-ex-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.target.closest(".detail-exercise").dataset.index);
      confirmModal("Delete this exercise?", "This removes it and all its sets from the workout.", { confirmLabel: "Delete", danger: true })
        .then((ok) => {
          if (!ok) return;
          w.exercises.splice(i, 1);
          finishDetailMutation(w);
        });
    });
  });

  container.querySelectorAll(".del-set-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const exDiv = e.target.closest(".detail-exercise");
      const i = Number(exDiv.dataset.index);
      const si = Number(e.target.closest(".detail-set-line").dataset.setIndex);
      confirmModal("Delete this set?", "", { confirmLabel: "Delete", danger: true }).then((ok) => {
        if (!ok) return;
        w.exercises[i].sets.splice(si, 1);
        w.exercises[i].sets.forEach((s, idx) => { s.setNumber = idx + 1; });
        if (w.exercises[i].sets.length === 0) {
          w.exercises.splice(i, 1);
        } else {
          w.exercises[i].pr = computePRs(data, w.exercises[i].exerciseId, w.exercises[i].sets, w.id);
        }
        finishDetailMutation(w);
      });
    });
  });
}

function finishDetailMutation(w) {
  if (w.exercises.length === 0) {
    data.workouts = data.workouts.filter((x) => x.id !== w.id);
    saveData(data);
    showToast("Workout deleted (no exercises left)");
    popToScreen("screen-history");
  } else {
    saveData(data);
    showToast("Saved");
    renderHistoryDetail(w.id);
  }
}

/* ==========================================================================
   EXERCISE LIBRARY + PROGRESS
   ========================================================================== */

function renderLibrary() {
  document.getElementById("libSearch").value = "";
  renderLibraryGrouped();
}

function renderLibraryGrouped() {
  const all = getAllExercises(data);
  let html = "";
  for (const group of MUSCLE_GROUPS) {
    const list = all.filter((e) => e.muscleGroup === group).sort((a, b) => a.name.localeCompare(b.name));
    if (list.length === 0) continue;
    html += `<div class="section-header"><h2>${group}</h2></div><div class="exercise-list">${list.map(exerciseRowHtml).join("")}</div>`;
  }
  document.getElementById("libContainer").innerHTML = html;
  wireLibraryRows();
}

function wireLibraryRows() {
  document.querySelectorAll("#libContainer .exercise-row").forEach((row) => {
    row.addEventListener("click", () => openExerciseProgress(row.dataset.id));
  });
}

function openExerciseProgress(exerciseId) {
  const ex = getAllExercises(data).find((x) => x.id === exerciseId);
  if (!ex) return;
  pushScreen("screen-exercise-progress", ex.name, () => renderExerciseProgress(exerciseId));
  renderExerciseProgress(exerciseId);
}

function renderExerciseProgress(exerciseId) {
  const ex = getAllExercises(data).find((x) => x.id === exerciseId);
  const history = getExerciseHistory(data, exerciseId);
  const container = document.getElementById("progressContainer");

  if (history.length === 0) {
    container.innerHTML = `<div class="card"><p class="empty-state" style="padding:8px 0;">No history yet for ${escapeHtml(ex.name)}. Log it in a workout to start tracking progress.</p></div>
      <button class="btn btn-primary btn-block btn-lg" id="logExerciseBtn">Log This Exercise</button>`;
  } else {
    const last = history[0];
    const prev = history[1];
    let maxWeight = 0, maxVolume = 0, maxReps = 0;
    history.forEach((h) => {
      if (h.volume > maxVolume) maxVolume = h.volume;
      h.sets.forEach((s) => {
        if (s.completed) {
          if (Number(s.weight) > maxWeight) maxWeight = Number(s.weight);
          if (Number(s.reps) > maxReps) maxReps = Number(s.reps);
        }
      });
    });
    container.innerHTML = `
      <div class="progress-card">
        <div class="card-title">Last Workout — ${formatDateHuman(last.date)}</div>
        <div>${setsSummaryString(last.sets)}</div>
      </div>
      ${prev ? `<div class="progress-card"><div class="card-title">Previous — ${formatDateHuman(prev.date)}</div><div>${setsSummaryString(prev.sets)}</div></div>` : ""}
      <div class="progress-card">
        <div class="card-title">Personal Bests</div>
        <div class="progress-row"><span class="p-label">Max Weight</span><span class="p-value">${maxWeight} kg</span></div>
        <div class="progress-row"><span class="p-label">Max Reps (single set)</span><span class="p-value">${maxReps}</span></div>
        <div class="progress-row"><span class="p-label">Max Volume (session)</span><span class="p-value">${Math.round(maxVolume)} kg</span></div>
      </div>
      <div class="section-header"><h2>History</h2></div>
      <div class="history-mini-list">
        ${history.map((h) => `<div class="history-mini-row"><span class="hm-date">${formatDateHuman(h.date)}</span><span>${setsSummaryString(h.sets)}</span></div>`).join("")}
      </div>
      <button class="btn btn-primary btn-block btn-lg" id="logExerciseBtn" style="margin-top:16px;">Log This Exercise</button>
    `;
  }

  document.getElementById("logExerciseBtn").addEventListener("click", () => {
    ensureDraft();
    currentMuscleGroup = ex.muscleGroup;
    openSetEntry(ex, { mode: "draft", editIndex: null, workoutId: null });
  });
}

/* ==========================================================================
   MODALS + TOAST
   ========================================================================== */

function showModalRaw(innerHtml) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-overlay"><div class="modal-sheet">${innerHtml}</div></div>`;
  return root.querySelector(".modal-overlay");
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function confirmModal(title, body, opts = {}) {
  return new Promise((resolve) => {
    const { confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false } = opts;
    const overlay = showModalRaw(`
      <div class="modal-title">${escapeHtml(title)}</div>
      ${body ? `<div class="modal-body">${escapeHtml(body)}</div>` : ""}
      <div class="modal-actions">
        <button class="btn btn-outline" id="modalCancelBtn">${escapeHtml(cancelLabel)}</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="modalConfirmBtn">${escapeHtml(confirmLabel)}</button>
      </div>
    `);
    const finish = (val) => { closeModal(); resolve(val); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(false); });
    document.getElementById("modalCancelBtn").addEventListener("click", () => finish(false));
    document.getElementById("modalConfirmBtn").addEventListener("click", () => finish(true));
  });
}

function addExerciseModal(defaultGroup) {
  return new Promise((resolve) => {
    const options = MUSCLE_GROUPS.map((g) => `<option value="${g}" ${g === defaultGroup ? "selected" : ""}>${g}</option>`).join("");
    const overlay = showModalRaw(`
      <div class="modal-title">Add Custom Exercise</div>
      <input type="text" id="newExName" class="modal-input" placeholder="Exercise name" maxlength="60" />
      <select id="newExGroup" class="modal-select">${options}</select>
      <div class="modal-actions">
        <button class="btn btn-outline" id="modalCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="modalConfirmBtn">Add</button>
      </div>
    `);
    const finish = (val) => { closeModal(); resolve(val); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(null); });
    document.getElementById("modalCancelBtn").addEventListener("click", () => finish(null));
    document.getElementById("modalConfirmBtn").addEventListener("click", () => {
      const name = document.getElementById("newExName").value.trim();
      const group = document.getElementById("newExGroup").value;
      if (!name) { showToast("Enter an exercise name"); return; }
      finish({ name, muscleGroup: group });
    });
    document.getElementById("newExName").focus();
  });
}

let toastTimer = null;
function showToast(msg, type = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast" + (type ? " " + type : "");
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2400);
}

/* ==========================================================================
   EVENT WIRING (static elements)
   ========================================================================== */

document.getElementById("backBtn").addEventListener("click", goBack);

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const nav = btn.dataset.nav;
    setActiveNav(nav);
    if (nav === "home") resetStackTo("screen-home", APP_TITLE, renderHome);
    else if (nav === "workout") enterWorkoutFlow();
    else if (nav === "history") resetStackTo("screen-history", "History", renderHistoryList);
    else if (nav === "exercises") resetStackTo("screen-exercises", "Exercise Library", renderLibrary);
  });
});

document.getElementById("startWorkoutBtn").addEventListener("click", enterWorkoutFlow);
document.getElementById("finishFromMuscleBtn").addEventListener("click", backToSummary);

document.getElementById("exerciseSearch").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const list = getAllExercises(data)
    .filter((ex) => ex.muscleGroup === currentMuscleGroup && ex.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  renderExerciseRows(list);
});

document.getElementById("addCustomExerciseBtn").addEventListener("click", () => {
  addExerciseModal(currentMuscleGroup).then((res) => {
    if (!res) return;
    addCustomExercise(data, res.name, res.muscleGroup);
    showToast("Exercise added");
    if (res.muscleGroup === currentMuscleGroup) renderExerciseList(currentMuscleGroup);
  });
});

document.getElementById("addSetBtn").addEventListener("click", () => {
  const last = currentEntry.sets[currentEntry.sets.length - 1];
  currentEntry.sets.push({
    setNumber: currentEntry.sets.length + 1,
    weight: last ? last.weight : "",
    reps: last ? last.reps : "",
    rpe: "",
    completed: false
  });
  renderSetRows();
});

document.getElementById("saveExerciseBtn").addEventListener("click", saveCurrentExerciseEntry);
document.getElementById("deleteExerciseBtn").addEventListener("click", deleteCurrentExerciseEntry);

document.getElementById("addAnotherExerciseBtn").addEventListener("click", () => {
  pushScreen("screen-muscle", "Start Workout", renderMuscleScreen);
  renderMuscleScreen();
});

document.getElementById("saveWorkoutBtn").addEventListener("click", () => {
  if (!draft || draft.exercises.length === 0) {
    showToast("Add at least one exercise first");
    return;
  }
  draft.finishedAt = new Date().toISOString();
  const ms = new Date(draft.finishedAt) - new Date(draft.startedAt);
  draft.duration = Math.max(1, Math.round(ms / 60000));
  data.workouts.push(draft);
  saveData(data);
  clearDraft();
  draft = null;
  showToast("Workout saved ✓");
  resetStackTo("screen-home", APP_TITLE, renderHome);
  setActiveNav("home");
});

document.getElementById("discardWorkoutBtn").addEventListener("click", () => {
  confirmModal("Discard this workout?", "All exercises and sets you entered will be lost.", { confirmLabel: "Discard", danger: true })
    .then((ok) => {
      if (!ok) return;
      clearDraft();
      draft = null;
      showToast("Workout discarded");
      resetStackTo("screen-home", APP_TITLE, renderHome);
      setActiveNav("home");
    });
});

document.getElementById("libSearch").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { renderLibraryGrouped(); return; }
  const all = getAllExercises(data).filter((ex) => ex.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  document.getElementById("libContainer").innerHTML = `<div class="exercise-list">${all.map(exerciseRowHtml).join("") || '<p class="empty-state">No matches.</p>'}</div>`;
  wireLibraryRows();
});

document.getElementById("libAddCustomBtn").addEventListener("click", () => {
  addExerciseModal(MUSCLE_GROUPS[0]).then((res) => {
    if (!res) return;
    addCustomExercise(data, res.name, res.muscleGroup);
    showToast("Exercise added");
    renderLibrary();
  });
});

document.getElementById("exportBtn").addEventListener("click", () => {
  exportData(data);
  showToast("Backup downloaded");
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFileInput").click();
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      showToast("Could not read file — invalid JSON");
      return;
    }
    if (!validateImportedData(parsed)) {
      showToast("Invalid backup file");
      return;
    }
    confirmModal("Import data?", "This will replace all current workouts and custom exercises with the contents of this file.", { confirmLabel: "Import", danger: true })
      .then((ok) => {
        if (!ok) return;
        data = { version: 1, customExercises: parsed.customExercises, workouts: parsed.workouts };
        saveData(data);
        clearDraft();
        draft = null;
        showToast("Data imported");
        resetStackTo("screen-home", APP_TITLE, renderHome);
        setActiveNav("home");
      });
  };
  reader.readAsText(file);
  e.target.value = "";
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
  confirmModal("Clear all data?", "This permanently deletes every workout and custom exercise. This cannot be undone.", { confirmLabel: "Clear All", danger: true })
    .then((ok) => {
      if (!ok) return;
      localStorage.removeItem(DATA_KEY);
      localStorage.removeItem(DRAFT_KEY);
      data = emptyData();
      draft = null;
      showToast("All data cleared");
      resetStackTo("screen-home", APP_TITLE, renderHome);
      setActiveNav("home");
    });
});

/* ==========================================================================
   PWA: install prompt + service worker
   ========================================================================== */

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById("installBtn").classList.remove("hidden");
});

document.getElementById("installBtn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById("installBtn").classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  document.getElementById("installBtn").classList.add("hidden");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker registration failed:", err));
  });
}

/* ==========================================================================
   INIT
   ========================================================================== */

resetStackTo("screen-home", APP_TITLE, renderHome);
setActiveNav("home");
