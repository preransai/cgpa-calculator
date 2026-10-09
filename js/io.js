import { analyze, gradeCourse, round, toPercentage } from './calc.js';
import { normalizeState } from './state.js';

const APP_TAG = 'cgpa-calculator';
const FILE_VERSION = 1;

export function toJSON(state, exportedAt = new Date()) {
  const data = {
    app: APP_TAG,
    version: FILE_VERSION,
    exportedAt: exportedAt.toISOString(),
    scheme: state.schemeId,
    mode: state.mode,
    semesters: state.semesters.map((semester) => ({
      courses: semester.courses.map(({ name, credits, grade }) => ({ name, credits, grade })),
    })),
    quick: state.quick.map(({ sgpa, credits }) => ({ sgpa, credits })),
    planner: { ...state.planner },
  };
  return JSON.stringify(data, null, 2);
}

export function fromJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const looksRight =
    data &&
    typeof data === 'object' &&
    (Array.isArray(data.semesters) || Array.isArray(data.quick));
  if (!looksRight || (data.app && data.app !== APP_TAG)) {
    throw new Error('That file does not look like a CGPA Calculator export.');
  }
  if (Number(data.version) > FILE_VERSION) {
    throw new Error('That file was saved by a newer version of the calculator.');
  }
  return normalizeState(data);
}

// Spreadsheet apps evaluate text cells that start with these characters.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const gpaCell = (value) => (value === null ? '' : round(value).toFixed(2));

function courseRows(state, scheme) {
  const rows = [['Semester', 'Course', 'Credits', 'Grade', 'Grade points', 'Credit points']];
  state.semesters.forEach((semester, index) => {
    for (const course of semester.courses) {
      const graded = gradeCourse(course, scheme);
      rows.push([
        index + 1,
        course.name.trim(),
        course.credits,
        course.grade,
        graded ? graded.points : '',
        graded ? round(graded.credits * graded.points) : '',
      ]);
    }
  });
  return rows;
}

export function toCSV(state, scheme) {
  const analysis = analyze(state, scheme);
  const detailed = state.mode !== 'quick';
  const rows = detailed ? [...courseRows(state, scheme), []] : [];

  rows.push(['Semester', 'Credits', 'SGPA', 'CGPA after semester']);
  analysis.semesters.forEach((semester, index) => {
    rows.push([index + 1, round(semester.credits), gpaCell(semester.gpa), gpaCell(semester.cgpa)]);
  });

  const { total } = analysis;
  rows.push([], ['Grading scheme', scheme.name], ['CGPA', gpaCell(total.gpa)]);
  rows.push(['Total credits', round(total.credits)]);
  if (detailed) {
    rows.push(['Credits earned', round(total.earned)], ['Backlogs', total.backlogs]);
  }
  const percent = toPercentage(total.gpa, scheme);
  if (percent !== null) rows.push(['Percentage', percent.toFixed(2)]);

  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
