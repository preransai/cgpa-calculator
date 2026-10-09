import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ceil2, planTarget } from '../js/planner.js';

const plan = (current, options = {}) =>
  planTarget({
    current,
    target: 8,
    totalSemesters: 8,
    semesterCredits: 20,
    max: 10,
    ...options,
  });

// 7 semesters x 20 credits at the given CGPA
const sevenDone = (cgpa) => ({ credits: 140, creditPoints: cgpa * 140, semesters: 7 });

describe('planTarget', () => {
  test('works out the average SGPA needed in the remaining semesters', () => {
    const result = plan(sevenDone(8), { target: 8.2 });
    assert.equal(result.status, 'possible');
    assert.equal(result.required, 9.6);
    assert.equal(result.remaining, 1);
    assert.equal(result.remainingCredits, 20);
  });

  test('spreads the requirement over several semesters', () => {
    const current = { credits: 80, creditPoints: 600, semesters: 4 };
    const result = plan(current, { target: 8 });
    assert.equal(result.status, 'possible');
    assert.equal(result.required, 8.5);
  });

  test('rounds the requirement up so it is always enough', () => {
    const current = { credits: 21, creditPoints: 168, semesters: 1 };
    const result = plan(current, { target: 8.1, totalSemesters: 2 });
    assert.equal(result.required, 8.21);
  });

  test('reports when the target is already reached', () => {
    const result = plan(sevenDone(8.5), { target: 8 });
    assert.equal(result.status, 'reached');
    assert.equal(result.required, 4.5);
  });

  test('never asks for a negative SGPA', () => {
    const result = plan(sevenDone(9.8), { target: 5, totalSemesters: 8 });
    assert.equal(result.status, 'reached');
    assert.equal(result.required, 0);
  });

  test('flags targets that need more than the maximum grade point', () => {
    const result = plan(sevenDone(6), { target: 9 });
    assert.equal(result.status, 'impossible');
    assert.equal(result.required, 30);
    assert.equal(result.best, 6.5);
  });

  test('a requirement of exactly the maximum is still possible', () => {
    const current = { credits: 20, creditPoints: 180, semesters: 1 };
    const result = plan(current, { target: 9.5, totalSemesters: 2 });
    assert.equal(result.status, 'possible');
    assert.equal(result.required, 10);
  });

  test('with no data yet the requirement is the target itself', () => {
    const result = plan({ credits: 0, creditPoints: 0, semesters: 0 }, { target: 8.75 });
    assert.equal(result.status, 'possible');
    assert.equal(result.required, 8.75);
    assert.equal(result.cgpa, null);
  });

  test('reports when there are no semesters left to plan', () => {
    const done = { credits: 160, creditPoints: 1312, semesters: 8 };
    assert.deepEqual(
      [plan(done, { target: 8 }).status, plan(done, { target: 8 }).achieved],
      ['finished', true],
    );
    assert.equal(plan(done, { target: 8.5 }).achieved, false);
    assert.equal(plan(done, { totalSemesters: 6 }).status, 'finished');
  });

  test('works on the 4.0 scale', () => {
    const current = { credits: 60, creditPoints: 192, semesters: 4 };
    const result = plan(current, { target: 3.5, max: 4, semesterCredits: 15 });
    assert.equal(result.status, 'possible');
    assert.equal(result.required, 3.8);
    assert.equal(plan(current, { target: 4.5, max: 4 }).status, 'invalid');
  });

  test('accepts numeric strings straight from inputs', () => {
    const result = plan(sevenDone(8), {
      target: '8.2',
      totalSemesters: '8',
      semesterCredits: '20',
    });
    assert.equal(result.required, 9.6);
  });

  test('rejects bad input with a reason', () => {
    const current = sevenDone(8);
    for (const options of [
      { target: 0 },
      { target: '' },
      { target: 10.5 },
      { totalSemesters: 7.5 },
      { totalSemesters: 0 },
      { totalSemesters: 40 },
      { semesterCredits: 0 },
      { semesterCredits: 'abc' },
    ]) {
      const result = plan(current, options);
      assert.equal(result.status, 'invalid', JSON.stringify(options));
      assert.ok(result.reason.length > 0);
    }
  });
});

describe('ceil2', () => {
  test('rounds up to two decimals without float noise', () => {
    assert.equal(ceil2(8.2345), 8.24);
    assert.equal(ceil2(8.5), 8.5);
    assert.equal(ceil2(8.23 + 1e-12), 8.23);
    assert.equal(ceil2(0.1 + 0.2), 0.3);
  });
});
