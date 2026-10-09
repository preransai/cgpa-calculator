import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { csvCell, fromJSON, toCSV, toJSON } from '../js/io.js';
import { createSampleState } from '../js/sample.js';
import { getScheme } from '../js/schemes.js';

const stripIds = (state) => ({
  ...state,
  semesters: state.semesters.map(({ collapsed, courses }) => ({
    collapsed,
    courses: courses.map(({ name, credits, grade }) => ({ name, credits, grade })),
  })),
  quick: state.quick.map(({ sgpa, credits }) => ({ sgpa, credits })),
});

describe('JSON export and import', () => {
  test('round-trips the sample data', () => {
    const state = createSampleState();
    state.semesters.forEach((semester) => (semester.collapsed = false));
    const restored = fromJSON(toJSON(state));
    assert.deepEqual(stripIds(restored), stripIds(state));
  });

  test('round-trips quick mode, the scheme and planner settings', () => {
    const state = createSampleState();
    state.mode = 'quick';
    state.schemeId = 'vtu';
    state.planner = { target: 9, totalSemesters: 10, semesterCredits: 18 };
    const restored = fromJSON(toJSON(state));
    assert.equal(restored.mode, 'quick');
    assert.equal(restored.schemeId, 'vtu');
    assert.deepEqual(restored.planner, state.planner);
  });

  test('stamps the file so it can be recognised later', () => {
    const data = JSON.parse(toJSON(createSampleState(), new Date('2026-05-01T10:00:00Z')));
    assert.equal(data.app, 'cgpa-calculator');
    assert.equal(data.version, 1);
    assert.equal(data.exportedAt, '2026-05-01T10:00:00.000Z');
    assert.equal(data.semesters[0].courses[0].id, undefined);
  });

  test('rejects files that are not exports', () => {
    assert.throws(() => fromJSON('not json'), /not valid JSON/);
    assert.throws(() => fromJSON('42'), /does not look like/);
    assert.throws(() => fromJSON('{"hello": "world"}'), /does not look like/);
    assert.throws(() => fromJSON('{"app": "other-app", "semesters": []}'), /does not look like/);
    assert.throws(() => fromJSON('{"semesters": [], "version": 99}'), /newer version/);
  });

  test('cleans up hand-edited or partial files', () => {
    const state = fromJSON(
      JSON.stringify({
        scheme: 'unknown-uni',
        mode: 'weird',
        semesters: [
          { courses: [{ name: 42, credits: '3.5', grade: 'A' }, null, { credits: 'x' }] },
          ...Array.from({ length: 20 }, () => ({ courses: [] })),
        ],
        planner: { target: 'abc' },
      }),
    );
    assert.equal(state.schemeId, 'jntuh');
    assert.equal(state.mode, 'detailed');
    assert.equal(state.semesters.length, 16);
    assert.deepEqual(
      state.semesters[0].courses.map(({ name, credits, grade }) => [name, credits, grade]),
      [
        ['', 3.5, 'A'],
        ['', '', ''],
        ['', '', ''],
      ],
    );
    assert.equal(state.quick.length, 1);
    assert.equal(state.planner.target, '');
    assert.equal(state.planner.totalSemesters, 8);
  });
});

describe('CSV export', () => {
  test('escapes commas, quotes and line breaks', () => {
    assert.equal(csvCell('Data Structures'), 'Data Structures');
    assert.equal(csvCell('Probability, Statistics'), '"Probability, Statistics"');
    assert.equal(csvCell('The "C" Language'), '"The ""C"" Language"');
    assert.equal(csvCell('Line\nbreak'), '"Line\nbreak"');
    assert.equal(csvCell(null), '');
    assert.equal(csvCell(-2), '-2');
  });

  test('neutralises cells that a spreadsheet would run as formulas', () => {
    assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(csvCell('+91 lab'), "'+91 lab");
    assert.equal(csvCell('@risk'), "'@risk");
  });

  test('lists every course followed by a semester summary', () => {
    const csv = toCSV(createSampleState(), getScheme('jntuh'));
    const lines = csv.split('\r\n');
    assert.equal(lines[0], 'Semester,Course,Credits,Grade,Grade points,Credit points');
    assert.equal(lines[1], '1,Matrices and Calculus,4,A,8,32');
    assert.ok(lines.includes('3,Computer Oriented Statistical Methods,4,F,0,0'));
    assert.ok(lines.includes('Semester,Credits,SGPA,CGPA after semester'));
    assert.ok(lines.includes('7,20,9.10,8.21'));
    assert.ok(lines.includes('8,0,,'));
    assert.ok(lines.includes('CGPA,8.21'));
    assert.ok(lines.includes('Backlogs,1'));
    assert.ok(lines.includes('Percentage,77.10'));
  });

  test('quick mode exports the semester table only', () => {
    const state = { ...createSampleState(), mode: 'quick' };
    const csv = toCSV(state, getScheme('jntuh'));
    assert.ok(csv.startsWith('Semester,Credits,SGPA,CGPA after semester\r\n1,20,8.05,8.05'));
    assert.ok(!csv.includes('Backlogs'));
  });

  test('skips the percentage row for schemes without a conversion', () => {
    const state = {
      ...createSampleState(),
      mode: 'quick',
      quick: [{ id: 'q1', sgpa: 3.4, credits: 15 }],
    };
    const csv = toCSV(state, getScheme('us4'));
    assert.ok(csv.includes('CGPA,3.40'));
    assert.ok(!csv.includes('Percentage'));
  });
});
