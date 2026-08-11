/* Storage layer — all localStorage access goes through here.
   Data shape:
   {
     version: 1,
     customExercises: [{ id, name, muscleGroup, custom:true }],
     workouts: [
       {
         id, date (YYYY-MM-DD), startedAt (ISO), finishedAt (ISO), duration (minutes),
         exercises: [
           {
             exerciseId, exerciseName, muscleGroup,
             sets: [{ setNumber, weight, reps, rpe, completed }],
             pr: { weight:bool, reps:bool, volume:bool }
           }
         ]
       }
     ]
   }
*/

const DATA_KEY = "wt_data_v1";
const DRAFT_KEY = "wt_draft_v1";

function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyData() {
  return { version: 1, customExercises: [], workouts: [] };
}

function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyData();
    return {
      version: 1,
      customExercises: Array.isArray(parsed.customExercises) ? parsed.customExercises : [],
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : []
    };
  } catch (e) {
    console.error("Failed to load data, starting fresh.", e);
    return emptyData();
  }
}

function saveData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

function newDraft() {
  return {
    id: "w_" + Date.now(),
    date: todayStr(),
    startedAt: new Date().toISOString(),
    exercises: []
  };
}

/* ---------- Exercise library (default + custom) ---------- */

function getAllExercises(data) {
  return [...getDefaultExercises(), ...data.customExercises];
}

function addCustomExercise(data, name, muscleGroup) {
  const id = "custom_" + makeExerciseId(muscleGroup, name) + "_" + Date.now().toString(36);
  const ex = { id, name: name.trim(), muscleGroup, custom: true };
  data.customExercises.push(ex);
  saveData(data);
  return ex;
}

/* ---------- History / progress lookups ---------- */

/* All past instances of an exercise across saved (non-draft) workouts,
   sorted newest first. Each entry: { date, startedAt, sets, volume } */
function getExerciseHistory(data, exerciseId, excludeWorkoutId = null) {
  const entries = [];
  for (const w of data.workouts) {
    if (w.id === excludeWorkoutId) continue;
    for (const ex of w.exercises) {
      if (ex.exerciseId === exerciseId) {
        const completedSets = ex.sets.filter((s) => s.completed);
        const volume = completedSets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);
        entries.push({ date: w.date, startedAt: w.startedAt, sets: ex.sets, volume });
      }
    }
  }
  entries.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return entries;
}

/* Best set (by weight, tie-broken by reps) from a list of sets */
function bestSet(sets) {
  const completed = sets.filter((s) => s.completed && Number(s.weight) > 0);
  if (completed.length === 0) return null;
  return completed.reduce((best, s) => {
    if (!best) return s;
    if (Number(s.weight) > Number(best.weight)) return s;
    if (Number(s.weight) === Number(best.weight) && Number(s.reps) > Number(best.reps)) return s;
    return best;
  }, null);
}

/* Compute PR flags for a set of newly-entered sets, compared to all prior history */
function computePRs(data, exerciseId, currentSets, excludeWorkoutId = null) {
  const history = getExerciseHistory(data, exerciseId, excludeWorkoutId);
  const completedNow = currentSets.filter((s) => s.completed && Number(s.weight) > 0 && Number(s.reps) > 0);
  if (completedNow.length === 0) return { weight: false, reps: false, volume: false };

  let maxWeightEver = 0;
  let maxRepsAtWeight = {}; // weight -> max reps seen historically
  let maxVolumeEver = 0;

  for (const entry of history) {
    if (entry.volume > maxVolumeEver) maxVolumeEver = entry.volume;
    for (const s of entry.sets) {
      if (!s.completed) continue;
      const w = Number(s.weight) || 0;
      const r = Number(s.reps) || 0;
      if (w > maxWeightEver) maxWeightEver = w;
      if (!(w in maxRepsAtWeight) || r > maxRepsAtWeight[w]) maxRepsAtWeight[w] = r;
    }
  }

  const currentVolume = completedNow.reduce((sum, s) => sum + Number(s.weight) * Number(s.reps), 0);
  const currentMaxWeight = Math.max(...completedNow.map((s) => Number(s.weight)));

  let repsPR = false;
  for (const s of completedNow) {
    const w = Number(s.weight);
    const r = Number(s.reps);
    const priorBest = maxRepsAtWeight[w] || 0;
    if (r > priorBest) repsPR = true;
  }

  return {
    weight: history.length > 0 && currentMaxWeight > maxWeightEver,
    reps: history.length > 0 && repsPR,
    volume: history.length > 0 && currentVolume > maxVolumeEver
  };
}

/* ---------- Dashboard aggregates ---------- */

function getTodayWorkouts(data) {
  const today = todayStr();
  return data.workouts.filter((w) => w.date === today);
}

function getWeekWorkouts(data) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const monday = new Date(now);
  const diffToMonday = (dayOfWeek + 6) % 7;
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return data.workouts.filter((w) => new Date(w.startedAt) >= monday);
}

function getRecentWorkouts(data, limit = 5) {
  return [...data.workouts]
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .slice(0, limit);
}

/* ---------- Export / Import ---------- */

function exportData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-workout-tracker-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function validateImportedData(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (!Array.isArray(obj.workouts)) return false;
  if (!Array.isArray(obj.customExercises)) return false;
  return true;
}
