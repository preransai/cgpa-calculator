const TEN_POINT_CORE = [
  { grade: 'O', points: 10, label: 'Outstanding' },
  { grade: 'A+', points: 9, label: 'Excellent' },
  { grade: 'A', points: 8, label: 'Very good' },
  { grade: 'B+', points: 7, label: 'Good' },
  { grade: 'B', points: 6, label: 'Above average' },
  { grade: 'C', points: 5, label: 'Average' },
];

// JNTUH R22, clause 12. Distinction also needs every course cleared at the
// first attempt, which is the closest thing to "no backlogs" we can check.
function jntuhClass(cgpa, backlogs) {
  if (cgpa >= 8) return backlogs > 0 ? 'First Class' : 'First Class with Distinction';
  if (cgpa >= 7) return 'First Class';
  if (cgpa >= 6) return 'Second Class';
  if (cgpa >= 5) return 'Pass Class';
  return 'Below the 5.0 needed for the degree';
}

// Anna University R2021, clause 16.2 (same first-appearance condition).
function annaClass(cgpa, backlogs) {
  if (cgpa >= 8.5 && backlogs === 0) return 'First Class with Distinction';
  if (cgpa >= 6.5) return 'First Class';
  return 'Second Class';
}

export const SCHEMES = [
  {
    id: 'jntuh',
    name: 'JNTUH (R18 / R22)',
    max: 10,
    grades: [
      ...TEN_POINT_CORE,
      { grade: 'F', points: 0, label: 'Fail', fail: true },
      { grade: 'Ab', points: 0, label: 'Absent', fail: true },
    ],
    percentage: { formula: '(CGPA − 0.5) × 10', convert: (cgpa) => (cgpa - 0.5) * 10 },
    classify: jntuhClass,
    classRule: 'Per JNTUH R22 rules',
    defaultCredits: 3,
    semesterCredits: 20,
    defaultTarget: 8,
  },
  {
    id: 'vtu',
    name: 'VTU (2021 scheme)',
    max: 10,
    grades: [
      ...TEN_POINT_CORE,
      { grade: 'P', points: 4, label: 'Pass' },
      { grade: 'F', points: 0, label: 'Fail', fail: true },
    ],
    // VTU's (CGPA − 0.75) × 10 only applies to the 2015/2017/2018 schemes.
    percentage: { formula: 'CGPA × 10', convert: (cgpa) => cgpa * 10 },
    defaultCredits: 3,
    semesterCredits: 20,
    defaultTarget: 8,
  },
  {
    id: 'anna',
    name: 'Anna University (R2021)',
    max: 10,
    grades: [...TEN_POINT_CORE, { grade: 'U', points: 0, label: 'Reappearance', fail: true }],
    // R2021 clause 15.5: U grades are left out of both the numerator and the
    // denominator, so an arrear does not drag the GPA down until it is cleared.
    excludeFailed: true,
    percentage: { formula: 'CGPA × 10', convert: (cgpa) => cgpa * 10 },
    classify: annaClass,
    classRule: 'Per Anna University R2021 rules',
    defaultCredits: 3,
    semesterCredits: 22,
    defaultTarget: 8.5,
  },
  {
    id: 'ugc',
    name: 'Generic 10-point (UGC CBCS)',
    max: 10,
    grades: [
      ...TEN_POINT_CORE,
      { grade: 'P', points: 4, label: 'Pass' },
      { grade: 'F', points: 0, label: 'Fail', fail: true },
    ],
    percentage: { formula: 'CGPA × 9.5', convert: (cgpa) => cgpa * 9.5 },
    defaultCredits: 4,
    semesterCredits: 22,
    defaultTarget: 8,
  },
  {
    id: 'us4',
    name: '4.0 scale (US)',
    max: 4,
    grades: [
      { grade: 'A', points: 4, label: 'Excellent' },
      { grade: 'A-', points: 3.7 },
      { grade: 'B+', points: 3.3 },
      { grade: 'B', points: 3, label: 'Good' },
      { grade: 'B-', points: 2.7 },
      { grade: 'C+', points: 2.3 },
      { grade: 'C', points: 2, label: 'Satisfactory' },
      { grade: 'C-', points: 1.7 },
      { grade: 'D+', points: 1.3 },
      { grade: 'D', points: 1, label: 'Poor' },
      { grade: 'F', points: 0, label: 'Fail', fail: true },
    ],
    percentage: null,
    defaultCredits: 3,
    semesterCredits: 15,
    defaultTarget: 3.5,
  },
];

export const DEFAULT_SCHEME_ID = 'jntuh';

export function getScheme(id) {
  return SCHEMES.find((scheme) => scheme.id === id) ?? SCHEMES[0];
}

export function findGrade(scheme, grade) {
  return scheme.grades.find((entry) => entry.grade === grade);
}
