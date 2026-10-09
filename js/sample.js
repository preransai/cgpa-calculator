import { analyzeDetailed, round } from './calc.js';
import { getScheme } from './schemes.js';
import { createCourse, createQuickRow, uid } from './state.js';

// A JNTUH R22 CSE student going into the final semester: one backlog in
// 2-1 statistics, zero-credit mandatory courses, and 4-2 results still awaited.
const SEMESTERS = [
  [
    ['Matrices and Calculus', 4, 'A'],
    ['Engineering Chemistry', 4, 'B+'],
    ['Programming for Problem Solving', 4, 'A+'],
    ['Basic Electrical Engineering', 3, 'B+'],
    ['Computer Aided Engineering Graphics', 3, 'A'],
    ['Engineering Chemistry Lab', 1, 'O'],
    ['Programming for Problem Solving Lab', 1, 'O'],
  ],
  [
    ['Ordinary Differential Equations and Vector Calculus', 4, 'B+'],
    ['Applied Physics', 4, 'A'],
    ['English for Skill Enhancement', 2, 'A+'],
    ['Electronic Devices and Circuits', 2, 'B'],
    ['Python Programming Lab', 2, 'O'],
    ['Engineering Workshop', 1.5, 'A'],
    ['Applied Physics Lab', 1.5, 'A+'],
    ['English Language and Communication Skills Lab', 1, 'A'],
    ['IT Workshop', 1, 'O'],
  ],
  [
    ['Computer Oriented Statistical Methods', 4, 'F'],
    ['Data Structures', 3, 'A+'],
    ['Digital Electronics', 3, 'B+'],
    ['Computer Organization and Architecture', 3, 'B'],
    ['Object Oriented Programming through Java', 3, 'A'],
    ['Data Structures Lab', 1.5, 'O'],
    ['Java Programming Lab', 1.5, 'A+'],
    ['Skill Development Course (Node JS)', 1, 'O'],
    ['Gender Sensitization Lab', 0, 'A'],
  ],
  [
    ['Discrete Mathematics', 3, 'A'],
    ['Business Economics and Financial Analysis', 3, 'B+'],
    ['Operating Systems', 3, 'A+'],
    ['Database Management Systems', 3, 'A'],
    ['Software Engineering', 3, 'A+'],
    ['Operating Systems Lab', 1, 'O'],
    ['Database Management Systems Lab', 1, 'O'],
    ['Real-time Research Project', 2, 'O'],
    ['Skill Development Course (Spring MVC)', 1, 'A+'],
    ['Constitution of India', 0, 'B+'],
  ],
  [
    ['Design and Analysis of Algorithms', 4, 'A'],
    ['Computer Networks', 3, 'A+'],
    ['DevOps', 3, 'A'],
    ['Formal Languages and Automata Theory', 3, 'B+'],
    ['Software Testing Methodologies', 3, 'A+'],
    ['Computer Networks Lab', 1, 'O'],
    ['DevOps Lab', 1, 'A+'],
    ['Advanced English Communication Skills Lab', 1, 'A+'],
    ['UI Design with Flutter', 1, 'O'],
    ['Environmental Science', 0, 'A'],
  ],
  [
    ['Machine Learning', 4, 'O'],
    ['Compiler Design', 3, 'A'],
    ['Artificial Intelligence', 3, 'A+'],
    ['Cloud Computing', 3, 'A'],
    ['Internet of Things', 3, 'B+'],
    ['Machine Learning Lab', 1, 'O'],
    ['Compiler Design Lab', 1, 'A+'],
    ['Industry Oriented Mini Project', 2, 'O'],
    ['Intellectual Property Rights', 0, 'A'],
  ],
  [
    ['Cryptography and Network Security', 3, 'A+'],
    ['Deep Learning', 3, 'O'],
    ['Natural Language Processing', 3, 'A+'],
    ['Distributed Systems', 3, 'A'],
    ['Fundamentals of Management for Engineers', 3, 'A'],
    ['Cryptography and Network Security Lab', 1, 'O'],
    ['Project Stage I', 4, 'O'],
  ],
  [
    ['Organizational Behaviour', 3, ''],
    ['Big Data Analytics', 3, ''],
    ['Blockchain Technology', 3, ''],
    ['Technical Seminar', 2, ''],
    ['Project Stage II', 9, ''],
  ],
];

export function createSampleState() {
  const scheme = getScheme('jntuh');
  const semesters = SEMESTERS.map((courses, index) => ({
    id: uid('s'),
    collapsed: index < 4,
    courses: courses.map(([name, credits, grade]) => createCourse(credits, name, grade)),
  }));

  // Quick mode gets the same semesters as they would appear on the grade sheets.
  const quick = analyzeDetailed(semesters, scheme)
    .semesters.filter((semester) => semester.gpa !== null)
    .map((semester) => createQuickRow(semester.credits, round(semester.gpa)));

  return {
    schemeId: scheme.id,
    mode: 'detailed',
    semesters,
    quick,
    planner: { target: 8.3, totalSemesters: 8, semesterCredits: 20 },
  };
}
