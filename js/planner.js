import { toNumber } from './calc.js';

const MAX_PLAN_SEMESTERS = 16;
const EPSILON = 1e-9;

// Rounded up, because rounding 8.234 down to 8.23 would fall just short.
export function ceil2(value) {
  return Math.ceil(value * 100 - EPSILON) / 100;
}

function invalid(field, reason) {
  return { status: 'invalid', field, reason };
}

// Solves (P + R·x) / (C + R) = target for x: the average SGPA needed over the
// remaining R credits, given C credits and P credit points so far.
export function planTarget({ current, target, totalSemesters, semesterCredits, max }) {
  const goal = toNumber(target);
  const semesters = toNumber(totalSemesters);
  const perSemester = toNumber(semesterCredits);

  if (!Number.isFinite(goal) || goal <= 0 || goal > max) {
    return invalid('target', `Enter a target between 0 and ${max}.`);
  }
  if (!Number.isInteger(semesters) || semesters < 1 || semesters > MAX_PLAN_SEMESTERS) {
    return invalid(
      'totalSemesters',
      `Total semesters should be a whole number from 1 to ${MAX_PLAN_SEMESTERS}.`,
    );
  }
  if (!Number.isFinite(perSemester) || perSemester <= 0 || perSemester > 60) {
    return invalid('semesterCredits', 'Credits per semester should be between 1 and 60.');
  }

  const cgpa = current.credits > 0 ? current.creditPoints / current.credits : null;
  const remaining = semesters - current.semesters;
  const base = {
    target: goal,
    cgpa,
    remaining,
    remainingCredits: Math.max(remaining, 0) * perSemester,
  };

  if (remaining <= 0) {
    return { ...base, status: 'finished', achieved: cgpa !== null && cgpa + EPSILON >= goal };
  }

  const futureCredits = remaining * perSemester;
  const totalCredits = current.credits + futureCredits;
  const required = (goal * totalCredits - current.creditPoints) / futureCredits;
  const best = (current.creditPoints + futureCredits * max) / totalCredits;

  if (required > max + EPSILON) {
    return { ...base, status: 'impossible', required: ceil2(required), best };
  }
  if (cgpa !== null && cgpa + EPSILON >= goal) {
    return { ...base, status: 'reached', required: Math.max(0, ceil2(required)) };
  }
  return { ...base, status: 'possible', required: ceil2(required) };
}
