/* Default exercise library, grouped by muscle group.
   Custom exercises added by the user are stored separately in app data
   and merged in at runtime by getAllExercises(). */

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Abs"];

const DEFAULT_EXERCISE_LIBRARY = {
  Chest: [
    "Incline Dumbbell Press",
    "Flat Dumbbell Press",
    "Decline Dumbbell Press",
    "Chest Press",
    "Pec Deck Fly",
    "Cable Fly"
  ],
  Back: [
    "Lat Pulldown",
    "Barbell Row",
    "Cable Row",
    "Close Grip Pulldown",
    "Straight Arm Pulldown",
    "Seated Row"
  ],
  Shoulders: [
    "Barbell Shoulder Press",
    "Dumbbell Shoulder Press",
    "Dumbbell Lateral Raise",
    "Cable Lateral Raise",
    "Face Pull",
    "Upright Row",
    "Barbell Shrug"
  ],
  Biceps: [
    "Barbell Curl",
    "Dumbbell Curl",
    "Incline Dumbbell Curl",
    "Hammer Curl",
    "Cable Curl"
  ],
  Triceps: [
    "Skull Crusher",
    "Tricep Pushdown",
    "Overhead Cable Extension",
    "Dumbbell Overhead Extension"
  ],
  Legs: [
    "Barbell Squat",
    "Leg Press",
    "Leg Extension",
    "Leg Curl",
    "Romanian Deadlift",
    "Calf Raise"
  ],
  Abs: [
    "Crunch",
    "Leg Raise",
    "Hanging Leg Raise",
    "Plank"
  ]
};

/* Stable id from muscle group + exercise name, e.g. "chest__incline-dumbbell-press" */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function makeExerciseId(muscleGroup, name) {
  return `${slugify(muscleGroup)}__${slugify(name)}`;
}

/* Returns the full default library flattened into exercise objects */
function getDefaultExercises() {
  const list = [];
  for (const group of MUSCLE_GROUPS) {
    for (const name of DEFAULT_EXERCISE_LIBRARY[group]) {
      list.push({
        id: makeExerciseId(group, name),
        name,
        muscleGroup: group,
        custom: false
      });
    }
  }
  return list;
}
