import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { classify, toPercentage } from '../js/calc.js';
import { DEFAULT_SCHEME_ID, SCHEMES, findGrade, getScheme } from '../js/schemes.js';

const pointsOf = (id) =>
  Object.fromEntries(getScheme(id).grades.map(({ grade, points }) => [grade, points]));

describe('scheme definitions', () => {
  test('every preset is internally consistent', () => {
    const ids = new Set();
    for (const scheme of SCHEMES) {
      assert.ok(!ids.has(scheme.id), `duplicate id ${scheme.id}`);
      ids.add(scheme.id);

      const letters = scheme.grades.map((g) => g.grade);
      assert.equal(new Set(letters).size, letters.length, `${scheme.id} repeats a grade`);
      assert.equal(scheme.grades[0].points, scheme.max, `${scheme.id} top grade should equal max`);
      assert.ok(
        scheme.grades.some((g) => g.fail),
        `${scheme.id} needs a failing grade`,
      );

      const points = scheme.grades.map((g) => g.points);
      assert.deepEqual(
        points,
        [...points].sort((a, b) => b - a),
        `${scheme.id} is not sorted`,
      );
      assert.ok(points.every((p) => p >= 0 && p <= scheme.max));
      assert.ok(scheme.defaultTarget > 0 && scheme.defaultTarget <= scheme.max);
    }
  });

  test('JNTUH is the default and unknown ids fall back to it', () => {
    assert.equal(DEFAULT_SCHEME_ID, 'jntuh');
    assert.equal(getScheme('nope').id, 'jntuh');
    assert.equal(getScheme(undefined).id, 'jntuh');
  });

  test('grade points match each regulation', () => {
    assert.deepEqual(pointsOf('jntuh'), { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, F: 0, Ab: 0 });
    assert.deepEqual(pointsOf('vtu'), { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 });
    assert.deepEqual(pointsOf('anna'), { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, U: 0 });
    assert.deepEqual(pointsOf('ugc'), { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 });
    assert.deepEqual(pointsOf('us4'), {
      A: 4,
      'A-': 3.7,
      'B+': 3.3,
      B: 3,
      'B-': 2.7,
      'C+': 2.3,
      C: 2,
      'C-': 1.7,
      'D+': 1.3,
      D: 1,
      F: 0,
    });
  });

  test('findGrade is exact and case sensitive', () => {
    const jntuh = getScheme('jntuh');
    assert.equal(findGrade(jntuh, 'A+').points, 9);
    assert.equal(findGrade(jntuh, 'a+'), undefined);
    assert.equal(findGrade(jntuh, ''), undefined);
  });
});

describe('percentage conversion', () => {
  const percent = (id, cgpa) => toPercentage(cgpa, getScheme(id));

  test('JNTUH: (CGPA - 0.5) x 10', () => {
    assert.equal(percent('jntuh', 8.5), 80);
    assert.equal(percent('jntuh', 8.21), 77.1);
    assert.equal(percent('jntuh', 10), 95);
  });

  test('VTU 2021 scheme: CGPA x 10', () => {
    assert.equal(percent('vtu', 8.21), 82.1);
  });

  test('Anna University: CGPA x 10', () => {
    assert.equal(percent('anna', 7.68), 76.8);
  });

  test('Generic UGC CBCS: CGPA x 9.5', () => {
    assert.equal(percent('ugc', 8), 76);
    assert.equal(percent('ugc', 7.33), 69.64);
  });

  test('4.0 scale has no percentage conversion', () => {
    assert.equal(percent('us4', 3.6), null);
  });

  test('converts the rounded CGPA, clamps to 0-100 and passes null through', () => {
    assert.equal(percent('jntuh', 7.996), 75);
    assert.equal(percent('jntuh', 0.3), 0);
    assert.equal(percent('jntuh', null), null);
  });
});

describe('degree classification', () => {
  const jntuh = getScheme('jntuh');
  const anna = getScheme('anna');

  test('JNTUH R22 bands', () => {
    assert.equal(classify(8.4, 0, jntuh), 'First Class with Distinction');
    assert.equal(classify(8.4, 1, jntuh), 'First Class');
    assert.equal(classify(7.995, 0, jntuh), 'First Class with Distinction');
    assert.equal(classify(7, 0, jntuh), 'First Class');
    assert.equal(classify(6.99, 0, jntuh), 'Second Class');
    assert.equal(classify(5.2, 0, jntuh), 'Pass Class');
    assert.match(classify(4.8, 0, jntuh), /Below/);
  });

  test('Anna University R2021 bands', () => {
    assert.equal(classify(8.5, 0, anna), 'First Class with Distinction');
    assert.equal(classify(9.1, 2, anna), 'First Class');
    assert.equal(classify(6.5, 0, anna), 'First Class');
    assert.equal(classify(6.49, 0, anna), 'Second Class');
  });

  test('schemes without a verified rule return null', () => {
    for (const id of ['vtu', 'ugc', 'us4']) {
      assert.equal(classify(8, 0, getScheme(id)), null);
    }
    assert.equal(classify(null, 0, jntuh), null);
  });
});
