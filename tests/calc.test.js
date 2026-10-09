import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyze,
  analyzeDetailed,
  analyzeQuick,
  combine,
  parseCredits,
  parseGpa,
  round,
  summarizeCourses,
} from '../js/calc.js';
import { getScheme } from '../js/schemes.js';

const jntuh = getScheme('jntuh');
const anna = getScheme('anna');

const courses = (...rows) =>
  rows.map(([credits, grade], i) => ({ id: `c${i}`, name: '', credits, grade }));
const semester = (id, ...rows) => ({ id, courses: courses(...rows) });

describe('round', () => {
  test('rounds half up to two decimals despite float representation', () => {
    assert.equal(round(7.245), 7.25);
    assert.equal(round(1.005), 1.01);
    assert.equal(round(8.2086), 8.21);
    assert.equal(round(7.2381), 7.24);
  });

  test('handles other precisions, tiny numbers and junk', () => {
    assert.equal(round(7.25, 1), 7.3);
    assert.equal(round(1e-7), 0);
    assert.equal(round(NaN), 0);
    assert.equal(round(Infinity), 0);
  });
});

describe('input parsing', () => {
  test('parseCredits accepts 0 to 30, including half credits', () => {
    assert.equal(parseCredits('3'), 3);
    assert.equal(parseCredits(1.5), 1.5);
    assert.equal(parseCredits(0), 0);
    assert.equal(parseCredits(''), null);
    assert.equal(parseCredits('  '), null);
    assert.equal(parseCredits('-1'), null);
    assert.equal(parseCredits(31), null);
    assert.equal(parseCredits('abc'), null);
    assert.equal(parseCredits(undefined), null);
  });

  test('parseGpa respects the scheme maximum', () => {
    assert.equal(parseGpa('9.5', 10), 9.5);
    assert.equal(parseGpa('9.5', 4), null);
    assert.equal(parseGpa(-0.1, 10), null);
    assert.equal(parseGpa('', 10), null);
  });
});

describe('summarizeCourses', () => {
  test('matches the SGPA illustration in the JNTUH R22 regulations (152 / 21)', () => {
    const result = summarizeCourses(
      courses([4, 'A'], [4, 'O'], [4, 'C'], [3, 'B'], [3, 'A+'], [3, 'C']),
      jntuh,
    );
    assert.equal(result.credits, 21);
    assert.equal(result.creditPoints, 152);
    assert.equal(round(result.gpa), 7.24);
  });

  test('counts a failed course in the denominator but not in earned credits', () => {
    const result = summarizeCourses(courses([4, 'O'], [4, 'F']), jntuh);
    assert.equal(result.gpa, 5);
    assert.equal(result.credits, 8);
    assert.equal(result.earned, 4);
    assert.equal(result.backlogs, 1);
  });

  test('treats Ab (absent) as a failure', () => {
    const result = summarizeCourses(courses([3, 'Ab'], [3, 'A']), jntuh);
    assert.equal(result.backlogs, 1);
    assert.equal(result.gpa, 4);
  });

  test('Anna University leaves U grades out of the GPA entirely', () => {
    const result = summarizeCourses(courses([4, 'O'], [4, 'U']), anna);
    assert.equal(result.gpa, 10);
    assert.equal(result.credits, 4);
    assert.equal(result.backlogs, 1);
  });

  test('skips rows without a grade, with bad credits or with a grade from another scheme', () => {
    const result = summarizeCourses(
      courses([3, 'A'], [3, ''], ['', 'O'], [-2, 'O'], [40, 'O'], [3, 'U']),
      jntuh,
    );
    assert.equal(result.graded, 1);
    assert.equal(result.credits, 3);
    assert.equal(result.gpa, 8);
  });

  test('returns null instead of NaN for empty or zero-credit semesters', () => {
    assert.equal(summarizeCourses([], jntuh).gpa, null);
    const zeroCredit = summarizeCourses(courses([0, 'A'], [0, 'O']), jntuh);
    assert.equal(zeroCredit.gpa, null);
    assert.equal(zeroCredit.graded, 2);
  });

  test('a failed zero-credit mandatory course is still a backlog', () => {
    const result = summarizeCourses(courses([3, 'A'], [0, 'F']), jntuh);
    assert.equal(result.gpa, 8);
    assert.equal(result.backlogs, 1);
  });
});

describe('CGPA across semesters', () => {
  test('matches the CGPA illustration in the JNTUH R22 regulations (518 / 69)', () => {
    const semesters = [
      semester('s1', [3, 'A'], [3, 'O'], [3, 'B'], [4, 'A'], [3, 'A+'], [4, 'C']),
      semester(
        's2',
        [4, 'B'],
        [4, 'A'],
        [3, 'C'],
        [3, 'O'],
        [3, 'B+'],
        [4, 'B'],
        [4, 'A'],
        [3, 'O'],
      ),
      semester('s3', [2, 'A'], [1, 'C'], [4, 'O'], [3, 'B+'], [4, 'B'], [4, 'A'], [3, 'B+']),
    ];
    const { total } = analyzeDetailed(semesters, jntuh);
    assert.equal(total.credits, 69);
    assert.equal(total.creditPoints, 518);
    assert.equal(round(total.gpa), 7.51);
  });

  test('weights by credits instead of averaging SGPAs', () => {
    const heavy = semester('s1', [10, 'A+'], [10, 'A+']);
    const light = semester('s2', [5, 'B'], [5, 'B']);
    const { semesters, total } = analyzeDetailed([heavy, light], jntuh);
    const naive = (semesters[0].gpa + semesters[1].gpa) / 2;
    assert.equal(naive, 7.5);
    assert.equal(total.gpa, 8);
  });

  test('tracks the running CGPA and ignores semesters with no results yet', () => {
    const result = analyzeDetailed(
      [semester('s1', [4, 'O']), semester('s2', [4, 'B']), semester('s3', [3, ''])],
      jntuh,
    );
    assert.deepEqual(
      result.semesters.map((s) => s.cgpa),
      [10, 8, null],
    );
    assert.equal(result.completed, 2);
    assert.equal(result.total.gpa, 8);
  });

  test('combine of nothing is a null CGPA, not NaN', () => {
    assert.equal(combine([]).gpa, null);
    assert.equal(analyzeDetailed([], jntuh).total.gpa, null);
  });

  test('totals backlogs and earned credits across semesters', () => {
    const { total } = analyzeDetailed(
      [semester('s1', [3, 'F'], [3, 'A']), semester('s2', [4, 'Ab'], [2, 'O'])],
      jntuh,
    );
    assert.equal(total.backlogs, 2);
    assert.equal(total.credits, 12);
    assert.equal(total.earned, 5);
  });
});

describe('quick mode', () => {
  test('weights each SGPA by its semester credits', () => {
    const rows = [
      { id: 'q1', sgpa: 9, credits: 20 },
      { id: 'q2', sgpa: '6', credits: '10' },
    ];
    const { total, semesters } = analyzeQuick(rows, jntuh);
    assert.equal(total.gpa, 8);
    assert.equal(total.credits, 30);
    assert.deepEqual(
      semesters.map((s) => s.cgpa),
      [9, 8],
    );
  });

  test('skips rows with an SGPA above the scale, zero credits or blanks', () => {
    const rows = [
      { id: 'q1', sgpa: 8, credits: 20 },
      { id: 'q2', sgpa: 11, credits: 20 },
      { id: 'q3', sgpa: 9, credits: 0 },
      { id: 'q4', sgpa: '', credits: 20 },
    ];
    const result = analyzeQuick(rows, jntuh);
    assert.equal(result.total.gpa, 8);
    assert.equal(result.completed, 1);
    assert.equal(analyzeQuick(rows, getScheme('us4')).total.gpa, null);
  });

  test('analyze picks the dataset for the current mode', () => {
    const state = {
      mode: 'quick',
      semesters: [semester('s1', [4, 'O'])],
      quick: [{ id: 'q1', sgpa: 7, credits: 20 }],
    };
    assert.equal(analyze(state, jntuh).total.gpa, 7);
    assert.equal(analyze({ ...state, mode: 'detailed' }, jntuh).total.gpa, 10);
  });
});
