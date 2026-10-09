import { findGrade } from './schemes.js';

export const MAX_CREDITS = 30;
export const MAX_SEMESTER_CREDITS = 60;

export function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return NaN;
  return Number(value);
}

export function parseCredits(value, max = MAX_CREDITS) {
  const credits = toNumber(value);
  return Number.isFinite(credits) && credits >= 0 && credits <= max ? credits : null;
}

export function parseGpa(value, max) {
  const gpa = toNumber(value);
  return Number.isFinite(gpa) && gpa >= 0 && gpa <= max ? gpa : null;
}

// Plain Math.round(x * 100) / 100 turns 7.245 into 7.24 because 7.245 is
// stored as 7.24499999... Shifting through the exponent avoids that.
export function round(value, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  if (String(value).includes('e')) return Math.round(value * 10 ** digits) / 10 ** digits;
  return Number(`${Math.round(Number(`${value}e${digits}`))}e-${digits}`);
}

const ratio = (points, credits) => (credits > 0 ? points / credits : null);

function emptyTotals() {
  return { credits: 0, creditPoints: 0, earned: 0, backlogs: 0, graded: 0 };
}

export function gradeCourse(course, scheme) {
  const credits = parseCredits(course.credits);
  const grade = findGrade(scheme, course.grade);
  if (credits === null || !grade) return null;
  return { credits, points: grade.points, failed: Boolean(grade.fail) };
}

export function summarizeCourses(courses, scheme) {
  const totals = emptyTotals();
  for (const course of courses) {
    const result = gradeCourse(course, scheme);
    if (!result) continue;
    totals.graded += 1;
    if (result.failed) {
      totals.backlogs += 1;
      if (scheme.excludeFailed) continue;
    } else {
      totals.earned += result.credits;
    }
    totals.credits += result.credits;
    totals.creditPoints += result.credits * result.points;
  }
  return { ...totals, gpa: ratio(totals.creditPoints, totals.credits) };
}

// CGPA is total credit points over total credits. Averaging the SGPAs would
// give a light semester the same weight as a heavy one.
export function combine(summaries) {
  const totals = emptyTotals();
  for (const summary of summaries) {
    for (const key of Object.keys(totals)) totals[key] += summary[key];
  }
  return { ...totals, gpa: ratio(totals.creditPoints, totals.credits) };
}

function withRunningCgpa(semesters) {
  let credits = 0;
  let creditPoints = 0;
  return semesters.map((semester) => {
    credits += semester.credits;
    creditPoints += semester.creditPoints;
    return { ...semester, cgpa: semester.gpa === null ? null : ratio(creditPoints, credits) };
  });
}

export function analyzeDetailed(semesters, scheme) {
  const results = withRunningCgpa(
    semesters.map((semester) => ({
      id: semester.id,
      ...summarizeCourses(semester.courses, scheme),
    })),
  );
  const total = combine(results);
  return { semesters: results, total, completed: results.filter((s) => s.gpa !== null).length };
}

// Quick mode only knows each semester's (already rounded) SGPA and credits, so
// failed courses and earned credits are not visible from here.
export function analyzeQuick(rows, scheme) {
  const results = withRunningCgpa(
    rows.map((row) => {
      const gpa = parseGpa(row.sgpa, scheme.max);
      const credits = parseCredits(row.credits, MAX_SEMESTER_CREDITS);
      const valid = gpa !== null && credits !== null && credits > 0;
      return {
        id: row.id,
        credits: valid ? credits : 0,
        creditPoints: valid ? gpa * credits : 0,
        earned: valid ? credits : 0,
        backlogs: 0,
        graded: valid ? 1 : 0,
        gpa: valid ? gpa : null,
      };
    }),
  );
  const total = combine(results);
  return { semesters: results, total, completed: results.filter((s) => s.gpa !== null).length };
}

export function analyze(state, scheme) {
  return state.mode === 'quick'
    ? analyzeQuick(state.quick, scheme)
    : analyzeDetailed(state.semesters, scheme);
}

// Grade sheets print the CGPA to two decimals and the conversions are applied
// to that printed value, so both helpers round first.
export function toPercentage(cgpa, scheme) {
  if (cgpa === null || !scheme.percentage) return null;
  const percent = scheme.percentage.convert(round(cgpa));
  return round(Math.min(100, Math.max(0, percent)));
}

export function classify(cgpa, backlogs, scheme) {
  if (cgpa === null || !scheme.classify) return null;
  return scheme.classify(round(cgpa), backlogs);
}
