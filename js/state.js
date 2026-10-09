import { DEFAULT_SCHEME_ID, getScheme } from './schemes.js';

export const STORAGE_KEY = 'cgpa-calculator:data';
export const MAX_SEMESTERS = 16;
export const MAX_COURSES = 25;
const NEW_SEMESTER_ROWS = 5;

let nextId = 0;
export const uid = (prefix) => `${prefix}${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function createCourse(credits = 3, name = '', grade = '') {
  return { id: uid('c'), name, credits, grade };
}

function createSemester(credits = 3, rows = NEW_SEMESTER_ROWS) {
  return {
    id: uid('s'),
    collapsed: false,
    courses: Array.from({ length: rows }, () => createCourse(credits)),
  };
}

export function createQuickRow(credits = 20, sgpa = '') {
  return { id: uid('q'), sgpa, credits };
}

export function createState(schemeId = DEFAULT_SCHEME_ID) {
  const scheme = getScheme(schemeId);
  return {
    schemeId: scheme.id,
    mode: 'detailed',
    semesters: [createSemester(scheme.defaultCredits)],
    quick: [createQuickRow(scheme.semesterCredits)],
    planner: {
      target: scheme.defaultTarget,
      totalSemesters: 8,
      semesterCredits: scheme.semesterCredits,
    },
  };
}

// Inputs are stored as typed: a number, or '' while the box is empty.
function cleanNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return '';
}

const cleanText = (value, maxLength) =>
  typeof value === 'string' ? value.slice(0, maxLength) : '';
const asArray = (value) => (Array.isArray(value) ? value : []);

// Accepts anything (old saves, hand-edited exports) and returns a usable state.
export function normalizeState(raw) {
  const fallback = createState(raw?.schemeId ?? raw?.scheme);
  if (!raw || typeof raw !== 'object') return fallback;

  const semesters = asArray(raw.semesters)
    .slice(0, MAX_SEMESTERS)
    .map((semester) => ({
      id: uid('s'),
      collapsed: Boolean(semester?.collapsed),
      courses: asArray(semester?.courses)
        .slice(0, MAX_COURSES)
        .map((course) =>
          createCourse(
            cleanNumber(course?.credits),
            cleanText(course?.name, 80),
            cleanText(course?.grade, 4),
          ),
        ),
    }));

  const quick = asArray(raw.quick)
    .slice(0, MAX_SEMESTERS)
    .map((row) => createQuickRow(cleanNumber(row?.credits), cleanNumber(row?.sgpa)));

  const planner = raw.planner && typeof raw.planner === 'object' ? raw.planner : {};

  return {
    schemeId: fallback.schemeId,
    mode: raw.mode === 'quick' ? 'quick' : 'detailed',
    semesters: semesters.length ? semesters : fallback.semesters,
    quick: quick.length ? quick : fallback.quick,
    planner: {
      target: cleanNumber(planner.target ?? fallback.planner.target),
      totalSemesters: cleanNumber(planner.totalSemesters ?? fallback.planner.totalSemesters),
      semesterCredits: cleanNumber(planner.semesterCredits ?? fallback.planner.semesterCredits),
    },
  };
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    return saved ? normalizeState(JSON.parse(saved)) : createState();
  } catch {
    return createState();
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function hasData(state) {
  return (
    state.semesters.some((s) => s.courses.some((c) => c.name.trim() || c.grade)) ||
    state.quick.some((row) => row.sgpa !== '')
  );
}

// The helpers below mutate the state in place and return what they touched,
// so the UI knows what to re-render and where to move focus.

export function findSemester(state, id) {
  return state.semesters.find((semester) => semester.id === id);
}

export function addSemester(state) {
  if (state.semesters.length >= MAX_SEMESTERS) return null;
  const semester = createSemester(getScheme(state.schemeId).defaultCredits);
  state.semesters.push(semester);
  return semester;
}

export function duplicateSemester(state, id) {
  const index = state.semesters.findIndex((semester) => semester.id === id);
  if (index === -1 || state.semesters.length >= MAX_SEMESTERS) return null;
  const copy = {
    id: uid('s'),
    collapsed: false,
    courses: state.semesters[index].courses.map((c) => createCourse(c.credits, c.name, c.grade)),
  };
  state.semesters.splice(index + 1, 0, copy);
  return copy;
}

export function removeSemester(state, id) {
  const index = state.semesters.findIndex((semester) => semester.id === id);
  if (index !== -1) state.semesters.splice(index, 1);
  return index;
}

export function addCourse(semester, credits = 3) {
  if (semester.courses.length >= MAX_COURSES) return null;
  const course = createCourse(credits);
  semester.courses.push(course);
  return course;
}

export function removeCourse(semester, courseId) {
  const index = semester.courses.findIndex((course) => course.id === courseId);
  if (index !== -1) semester.courses.splice(index, 1);
  return index;
}

export function addQuickRow(state) {
  if (state.quick.length >= MAX_SEMESTERS) return null;
  const row = createQuickRow(getScheme(state.schemeId).semesterCredits);
  state.quick.push(row);
  return row;
}

export function removeQuickRow(state, id) {
  const index = state.quick.findIndex((row) => row.id === id);
  if (index !== -1) state.quick.splice(index, 1);
  return index;
}
