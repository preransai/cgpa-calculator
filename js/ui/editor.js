import { MAX_CREDITS, MAX_SEMESTER_CREDITS, parseCredits, parseGpa } from '../calc.js';
import { formatCredits, formatGpa, plural } from '../format.js';
import { findGrade } from '../schemes.js';
import { MAX_COURSES, MAX_SEMESTERS } from '../state.js';
import { $, cloneTemplate, escapeHtml, setInvalid } from './dom.js';

const field = (row, name) => row.querySelector(`[data-field="${name}"]`);

function fillGradeOptions(select, scheme, current) {
  const options = ['<option value="">Grade</option>'];
  for (const { grade, points } of scheme.grades) {
    options.push(`<option value="${grade}">${grade} · ${points}</option>`);
  }
  // Keep a grade from another scheme visible instead of silently dropping it.
  if (current && !findGrade(scheme, current)) {
    const safe = escapeHtml(current);
    options.push(`<option value="${safe}" disabled>${safe} ?</option>`);
  }
  select.innerHTML = options.join('');
  select.value = current;
}

export function validateCourse(row, course, scheme) {
  const grade = findGrade(scheme, course.grade);
  const badCredits = course.credits !== '' && parseCredits(course.credits) === null;
  setInvalid(field(row, 'credits'), badCredits, `Credits must be between 0 and ${MAX_CREDITS}`);
  setInvalid(
    field(row, 'grade'),
    Boolean(course.grade) && !grade,
    `${course.grade} is not a grade in ${scheme.name}`,
  );
  row.classList.toggle('is-failed', Boolean(grade?.fail));
}

function renderCourse(course, semesterNumber, courseNumber, scheme) {
  const row = cloneTemplate('course-template');
  row.dataset.id = course.id;
  const where = `semester ${semesterNumber}, course ${courseNumber}`;

  const name = field(row, 'name');
  name.value = course.name;
  name.setAttribute('aria-label', `Name of ${where}`);

  const credits = field(row, 'credits');
  credits.value = course.credits;
  credits.setAttribute('aria-label', `Credits for ${where}`);

  const grade = field(row, 'grade');
  fillGradeOptions(grade, scheme, course.grade);
  grade.setAttribute('aria-label', `Grade for ${where}`);

  row.querySelector('[data-action="remove-course"]').setAttribute('aria-label', `Remove ${where}`);
  validateCourse(row, course, scheme);
  return row;
}

function renderSemester(semester, index, state, scheme) {
  const card = cloneTemplate('semester-template');
  const number = index + 1;
  const bodyId = `body-${semester.id}`;
  card.dataset.id = semester.id;

  card.querySelector('.semester__title').textContent = `Semester ${number}`;
  const toggle = card.querySelector('.semester__toggle');
  toggle.setAttribute('aria-expanded', String(!semester.collapsed));
  toggle.setAttribute('aria-controls', bodyId);

  const body = card.querySelector('.semester__body');
  body.id = bodyId;
  body.hidden = semester.collapsed;

  const duplicate = card.querySelector('[data-action="duplicate-semester"]');
  duplicate.setAttribute('aria-label', `Duplicate semester ${number}`);
  duplicate.title = 'Duplicate semester';
  duplicate.disabled = state.semesters.length >= MAX_SEMESTERS;
  const remove = card.querySelector('[data-action="remove-semester"]');
  remove.setAttribute('aria-label', `Remove semester ${number}`);
  remove.title = 'Remove semester';

  card.querySelector('[data-action="add-course"]').disabled =
    semester.courses.length >= MAX_COURSES;
  card
    .querySelector('.course-list')
    .append(...semester.courses.map((course, i) => renderCourse(course, number, i + 1, scheme)));
  return card;
}

function renderQuickRow(row, index, scheme) {
  const item = cloneTemplate('quick-template');
  const number = index + 1;
  item.dataset.id = row.id;
  item.querySelector('.quick-row__label').textContent = `Sem ${number}`;

  const sgpa = field(item, 'sgpa');
  sgpa.value = row.sgpa;
  sgpa.max = scheme.max;
  sgpa.setAttribute('aria-label', `SGPA for semester ${number}`);

  const credits = field(item, 'credits');
  credits.value = row.credits;
  credits.setAttribute('aria-label', `Total credits for semester ${number}`);

  const remove = item.querySelector('[data-action="remove-quick"]');
  remove.setAttribute('aria-label', `Remove semester ${number}`);
  validateQuickRow(item, row, scheme);
  return item;
}

export function validateQuickRow(item, row, scheme) {
  setInvalid(
    field(item, 'sgpa'),
    row.sgpa !== '' && parseGpa(row.sgpa, scheme.max) === null,
    `SGPA must be between 0 and ${scheme.max}`,
  );
  const credits = parseCredits(row.credits, MAX_SEMESTER_CREDITS);
  setInvalid(
    field(item, 'credits'),
    row.credits !== '' && !credits,
    `Credits must be more than 0 and at most ${MAX_SEMESTER_CREDITS}`,
  );
}

export function renderEditor(state, scheme) {
  const list = $('#semester-list');
  if (state.semesters.length) {
    list.replaceChildren(...state.semesters.map((s, i) => renderSemester(s, i, state, scheme)));
  } else {
    list.innerHTML =
      '<li class="card empty-state">No semesters yet. Add one below, or load the sample data to look around.</li>';
  }
  $('[data-action="add-semester"]').disabled = state.semesters.length >= MAX_SEMESTERS;

  $('#quick-list').replaceChildren(...state.quick.map((row, i) => renderQuickRow(row, i, scheme)));
  $('[data-action="add-quick"]').disabled = state.quick.length >= MAX_SEMESTERS;
}

function semesterMeta(semester, result, scheme) {
  const registered = semester.courses.reduce((sum, c) => sum + (parseCredits(c.credits) ?? 0), 0);
  const ungraded = semester.courses.filter((c) => !findGrade(scheme, c.grade)).length;
  const parts = [
    plural(semester.courses.length, 'course'),
    `${formatCredits(registered)} ${registered === 1 ? 'credit' : 'credits'}`,
  ];

  if (result.backlogs)
    parts.push(`<span class="flag">${plural(result.backlogs, 'backlog')}</span>`);
  if (semester.courses.length && result.graded === 0) {
    parts.push('<span class="pending">Results pending</span>');
  } else if (ungraded) {
    parts.push(`<span class="pending">${ungraded} not graded</span>`);
  }
  return parts.map((part) => (part.startsWith('<') ? part : `<span>${part}</span>`)).join('');
}

export function updateEditorResults(state, analysis, scheme) {
  if (state.mode === 'quick') {
    analysis.semesters.forEach((result) => {
      const cell = $(`.quick-row[data-id="${result.id}"] .quick-row__cgpa`);
      if (cell) cell.textContent = formatGpa(result.cgpa);
    });
    return;
  }

  state.semesters.forEach((semester, i) => {
    const card = $(`.semester[data-id="${semester.id}"]`);
    if (!card) return;
    const result = analysis.semesters[i];
    const pill = card.querySelector('.sgpa-pill');
    pill.classList.toggle('is-empty', result.gpa === null);
    pill.querySelector('.sgpa-pill__value').textContent = formatGpa(result.gpa);
    card.querySelector('.semester__meta').innerHTML = semesterMeta(semester, result, scheme);
  });
}
