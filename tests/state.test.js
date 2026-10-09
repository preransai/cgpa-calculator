import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { analyze, round } from '../js/calc.js';
import { createSampleState } from '../js/sample.js';
import { getScheme } from '../js/schemes.js';
import {
  MAX_COURSES,
  MAX_SEMESTERS,
  STORAGE_KEY,
  addCourse,
  addSemester,
  createState,
  duplicateSemester,
  hasData,
  loadState,
  removeCourse,
  removeSemester,
  saveState,
} from '../js/state.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    data,
  };
}

const brokenStorage = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

describe('initial state', () => {
  test('starts with one blank semester using the scheme defaults', () => {
    const state = createState('ugc');
    assert.equal(state.schemeId, 'ugc');
    assert.equal(state.mode, 'detailed');
    assert.equal(state.semesters.length, 1);
    assert.ok(state.semesters[0].courses.every((c) => c.credits === 4 && c.grade === ''));
    assert.equal(state.quick[0].credits, 22);
    assert.equal(hasData(state), false);
  });
});

describe('persistence', () => {
  test('saves and loads through storage', () => {
    const storage = memoryStorage();
    const state = createSampleState();
    assert.equal(saveState(state, storage), true);
    const loaded = loadState(storage);
    assert.equal(loaded.semesters.length, 8);
    assert.equal(loaded.semesters[2].courses[0].grade, 'F');
  });

  test('falls back to a fresh state on missing or corrupted data', () => {
    assert.equal(loadState(memoryStorage()).semesters.length, 1);
    const corrupted = memoryStorage({ [STORAGE_KEY]: '{"semesters": [' });
    assert.equal(loadState(corrupted).semesters.length, 1);
  });

  test('survives storage that throws (private mode, quota)', () => {
    assert.equal(loadState(brokenStorage).schemeId, 'jntuh');
    assert.equal(saveState(createState(), brokenStorage), false);
    assert.equal(loadState(undefined).semesters.length, 1);
  });
});

describe('editing helpers', () => {
  test('add, duplicate and remove semesters', () => {
    const state = createState();
    const [first] = state.semesters;
    first.courses[0].grade = 'A';
    const added = addSemester(state);
    const copy = duplicateSemester(state, first.id);

    assert.deepEqual(
      state.semesters.map((s) => s.id),
      [first.id, copy.id, added.id],
    );
    assert.equal(copy.courses[0].grade, 'A');
    assert.notEqual(copy.courses[0].id, first.courses[0].id);

    assert.equal(removeSemester(state, copy.id), 1);
    assert.equal(removeSemester(state, 'missing'), -1);
    assert.equal(state.semesters.length, 2);
  });

  test('respects the semester and course limits', () => {
    const state = createState();
    while (state.semesters.length < MAX_SEMESTERS) addSemester(state);
    assert.equal(addSemester(state), null);
    assert.equal(duplicateSemester(state, state.semesters[0].id), null);

    const semester = state.semesters[0];
    while (semester.courses.length < MAX_COURSES) addCourse(semester);
    assert.equal(addCourse(semester), null);
  });

  test('add and remove courses', () => {
    const [semester] = createState().semesters;
    const course = addCourse(semester, 1.5);
    assert.equal(course.credits, 1.5);
    assert.equal(semester.courses.length, 6);
    assert.equal(removeCourse(semester, course.id), 5);
    assert.equal(semester.courses.length, 5);
  });
});

describe('sample data', () => {
  test('is a JNTUH student with seven semesters of results and one awaited', () => {
    const state = createSampleState();
    const result = analyze(state, getScheme(state.schemeId));
    assert.equal(state.schemeId, 'jntuh');
    assert.equal(state.semesters.length, 8);
    assert.equal(result.completed, 7);
    assert.equal(round(result.total.gpa), 8.21);
    assert.equal(result.total.backlogs, 1);
    assert.equal(hasData(state), true);
  });

  test('quick mode rows agree with the detailed CGPA', () => {
    const state = createSampleState();
    const scheme = getScheme(state.schemeId);
    const detailed = analyze(state, scheme).total.gpa;
    const quick = analyze({ ...state, mode: 'quick' }, scheme).total.gpa;
    assert.ok(Math.abs(detailed - quick) < 0.01);
  });
});
