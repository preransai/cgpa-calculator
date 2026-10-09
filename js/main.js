import { analyze } from './calc.js';
import { plural } from './format.js';
import { fromJSON, toCSV, toJSON } from './io.js';
import { createSampleState } from './sample.js';
import { SCHEMES, findGrade, getScheme } from './schemes.js';
import {
  addCourse,
  addQuickRow,
  addSemester,
  createState,
  duplicateSemester,
  findSemester,
  hasData,
  loadState,
  removeCourse,
  removeQuickRow,
  removeSemester,
  saveState,
} from './state.js';
import { createTrendChart } from './ui/chart.js';
import { confirmDialog, setupHelp, toast } from './ui/dialogs.js';
import { $, $$, debounce, download, readNumber } from './ui/dom.js';
import {
  renderEditor,
  updateEditorResults,
  validateCourse,
  validateQuickRow,
} from './ui/editor.js';
import { fillPlannerInputs, renderPlan } from './ui/planner-panel.js';
import { renderReport } from './ui/report.js';
import { renderSummary } from './ui/summary.js';

const THEME_KEY = 'cgpa-calculator:theme';
const MODE_HINTS = {
  detailed: 'Add each course with its credits and grade. Everything updates as you type.',
  quick: 'Only have your grade sheets? Enter each semester’s SGPA and total credits.',
};

let state = loadState();
const chart = createTrendChart($('#trend-chart'));
const save = debounce(() => saveState(state), 250);
const currentScheme = () => getScheme(state.schemeId);

function chartPoints(analysis) {
  return analysis.semesters
    .map((result, i) => ({
      number: i + 1,
      sgpa: result.gpa,
      cgpa: result.cgpa,
      credits: result.credits,
    }))
    .filter((point) => point.sgpa !== null);
}

function refresh() {
  const scheme = currentScheme();
  const analysis = analyze(state, scheme);
  updateEditorResults(state, analysis, scheme);
  renderSummary(state, analysis, scheme);
  renderPlan(state, analysis, scheme);
  chart.update(chartPoints(analysis), scheme.max);
  save();
}

function renderAll() {
  const scheme = currentScheme();
  $('#scheme-select').value = scheme.id;
  for (const radio of $$('input[name="mode"]')) radio.checked = radio.value === state.mode;
  $('#detailed-editor').hidden = state.mode !== 'detailed';
  $('#quick-editor').hidden = state.mode !== 'quick';
  $('#mode-hint').textContent = MODE_HINTS[state.mode];
  renderEditor(state, scheme);
  fillPlannerInputs(state, scheme);
  refresh();
}

const focus = (selector) => $(selector)?.focus();
const today = () => new Date().toLocaleDateString('en-CA');

$('#scheme-select').innerHTML = SCHEMES.map(
  (scheme) => `<option value="${scheme.id}">${scheme.name}</option>`,
).join('');

$('#scheme-select').addEventListener('change', (event) => {
  const previous = currentScheme();
  const next = getScheme(event.target.value);
  const { planner } = state;
  state.schemeId = next.id;
  // Swap planner defaults over, but leave values the user has typed alone.
  if (next.max !== previous.max || planner.target === previous.defaultTarget) {
    planner.target = next.defaultTarget;
  }
  if (next.max !== previous.max || planner.semesterCredits === previous.semesterCredits) {
    planner.semesterCredits = next.semesterCredits;
  }
  renderAll();

  const unknown = state.semesters
    .flatMap((semester) => semester.courses)
    .filter((course) => course.grade && !findGrade(next, course.grade)).length;
  if (unknown && state.mode === 'detailed') {
    toast(`${plural(unknown, 'grade')} not used in ${next.name}. Marked in red.`, 'error');
  } else {
    toast(`Using ${next.name}`);
  }
});

$('#mode-switch').addEventListener('change', (event) => {
  state.mode = event.target.value;
  renderAll();
});

// Detailed mode

function locateCourse(element) {
  const semester = findSemester(state, element.closest('.semester')?.dataset.id);
  const row = element.closest('.course');
  const course = semester?.courses.find((c) => c.id === row?.dataset.id);
  return { semester, row, course };
}

$('#semester-list').addEventListener('input', (event) => {
  const input = event.target;
  const key = input.dataset.field;
  const { row, course } = locateCourse(input);
  if (!key || !course) return;
  course[key] = key === 'credits' ? readNumber(input) : input.value;
  validateCourse(row, course, currentScheme());
  refresh();
});

function addCourseTo(semester) {
  const course = addCourse(semester, currentScheme().defaultCredits);
  if (!course) {
    toast('That semester already has the maximum number of courses.', 'error');
    return;
  }
  semester.collapsed = false;
  renderAll();
  focus(`.course[data-id="${course.id}"] [data-field="name"]`);
}

$('#semester-list').addEventListener('keydown', (event) => {
  const key = event.target.dataset.field;
  if (event.key !== 'Enter' || !key) return;
  const { semester, row } = locateCourse(event.target);
  if (!row) return;
  event.preventDefault();
  // Enter walks down a column like a spreadsheet; on the last row it adds one.
  const next = row.nextElementSibling;
  if (next) next.querySelector(`[data-field="${key}"]`).focus();
  else addCourseTo(semester);
});

async function removeSemesterWithConfirm(semester) {
  const index = state.semesters.indexOf(semester);
  const filled = semester.courses.filter((c) => c.name.trim() || c.grade).length;
  if (filled) {
    const confirmed = await confirmDialog({
      title: `Remove semester ${index + 1}?`,
      message: `Its ${plural(semester.courses.length, 'course')} will be deleted. This cannot be undone.`,
      confirmLabel: 'Remove semester',
      danger: true,
    });
    if (!confirmed) return;
  }
  removeSemester(state, semester.id);
  renderAll();
  const next = state.semesters[Math.min(index, state.semesters.length - 1)];
  focus(
    next ? `.semester[data-id="${next.id}"] .semester__toggle` : '[data-action="add-semester"]',
  );
  toast(`Semester ${index + 1} removed`);
}

$('#detailed-editor').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const { semester, row } = locateCourse(button);

  if (button.classList.contains('semester__toggle')) {
    semester.collapsed = !semester.collapsed;
    button.setAttribute('aria-expanded', String(!semester.collapsed));
    $(`#${button.getAttribute('aria-controls')}`).hidden = semester.collapsed;
    save();
    return;
  }

  switch (button.dataset.action) {
    case 'add-semester': {
      const added = addSemester(state);
      if (!added) return;
      renderAll();
      $(`.semester[data-id="${added.id}"]`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      focus(`.semester[data-id="${added.id}"] [data-field="name"]`);
      break;
    }
    case 'duplicate-semester': {
      const copy = duplicateSemester(state, semester.id);
      if (!copy) return;
      renderAll();
      focus(`.semester[data-id="${copy.id}"] .semester__toggle`);
      toast(`Copied into semester ${state.semesters.indexOf(copy) + 1}`);
      break;
    }
    case 'remove-semester':
      removeSemesterWithConfirm(semester);
      break;
    case 'add-course':
      addCourseTo(semester);
      break;
    case 'remove-course': {
      const index = removeCourse(semester, row.dataset.id);
      renderAll();
      const neighbour = semester.courses[Math.min(index, semester.courses.length - 1)];
      focus(
        neighbour
          ? `.course[data-id="${neighbour.id}"] [data-field="name"]`
          : `.semester[data-id="${semester.id}"] [data-action="add-course"]`,
      );
      break;
    }
  }
});

// Quick mode

function locateQuickRow(element) {
  const item = element.closest('.quick-row');
  return { item, row: state.quick.find((r) => r.id === item?.dataset.id) };
}

function addQuick() {
  const row = addQuickRow(state);
  if (!row) return;
  renderAll();
  focus(`.quick-row[data-id="${row.id}"] [data-field="sgpa"]`);
}

$('#quick-list').addEventListener('input', (event) => {
  const key = event.target.dataset.field;
  const { item, row } = locateQuickRow(event.target);
  if (!key || !row) return;
  row[key] = readNumber(event.target);
  validateQuickRow(item, row, currentScheme());
  refresh();
});

$('#quick-list').addEventListener('keydown', (event) => {
  const key = event.target.dataset.field;
  if (event.key !== 'Enter' || !key) return;
  event.preventDefault();
  const next = locateQuickRow(event.target).item.nextElementSibling;
  if (next) next.querySelector(`[data-field="${key}"]`).focus();
  else addQuick();
});

$('#quick-editor').addEventListener('click', (event) => {
  const action = event.target.closest('button')?.dataset.action;
  if (action === 'add-quick') addQuick();
  if (action === 'remove-quick') {
    const { row } = locateQuickRow(event.target);
    const index = removeQuickRow(state, row.id);
    renderAll();
    const neighbour = state.quick[Math.min(index, state.quick.length - 1)];
    focus(
      neighbour
        ? `.quick-row[data-id="${neighbour.id}"] [data-field="sgpa"]`
        : '[data-action="add-quick"]',
    );
  }
});

// Toolbar

const actions = {
  async sample() {
    if (hasData(state)) {
      const confirmed = await confirmDialog({
        title: 'Replace your data with the sample?',
        message:
          'The sample is a JNTUH CSE student with seven semesters of results. Export a backup first if you want to keep what you have.',
        confirmLabel: 'Load sample',
      });
      if (!confirmed) return;
    }
    state = createSampleState();
    renderAll();
    toast('Sample data loaded');
  },
  import() {
    $('#import-file').click();
  },
  'export-json'() {
    download(`cgpa-backup-${today()}.json`, toJSON(state), 'application/json');
    toast('Backup saved as JSON');
  },
  'export-csv'() {
    // The BOM makes Excel read the file as UTF-8 instead of the system code page.
    download(`cgpa-report-${today()}.csv`, `﻿${toCSV(state, currentScheme())}`, 'text/csv');
    toast('CSV exported');
  },
  print() {
    window.print();
  },
  async reset() {
    const confirmed = await confirmDialog({
      title: 'Clear everything?',
      message: 'Every semester, course and planner value saved in this browser will be removed.',
      confirmLabel: 'Clear all data',
      danger: true,
    });
    if (!confirmed) return;
    state = createState(state.schemeId);
    renderAll();
    toast('All data cleared');
  },
};

$('.toolbar').addEventListener('click', (event) => {
  const action = event.target.closest('button')?.dataset.action;
  actions[action]?.();
});

$('#import-file').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 1_000_000)
      throw new Error('That file is too big to be a CGPA Calculator export.');
    state = fromJSON(await file.text());
    renderAll();
    toast(`Imported ${plural(state.semesters.length, 'semester')}`);
  } catch (error) {
    toast(error.message, 'error');
  }
});

window.addEventListener('beforeprint', () => {
  const scheme = currentScheme();
  const analysis = analyze(state, scheme);
  renderReport(state, analysis, scheme, chartPoints(analysis));
});

// Planner and the trend/planner tabs

$('#planner-form').addEventListener('input', (event) => {
  const key = event.target.name;
  if (!(key in state.planner)) return;
  state.planner[key] = readNumber(event.target);
  refresh();
});

$('#planner-form').addEventListener('submit', (event) => event.preventDefault());

const tabs = $$('[role="tab"]');

function selectTab(tab, moveFocus = false) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    $(`#${item.getAttribute('aria-controls')}`).hidden = !selected;
  }
  if (moveFocus) tab.focus();
}

for (const tab of tabs) tab.addEventListener('click', () => selectTab(tab));

$('.tabs').addEventListener('keydown', (event) => {
  const index = tabs.indexOf(document.activeElement);
  const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
  if (index === -1 || !(event.key in moves)) return;
  event.preventDefault();
  selectTab(tabs[(moves[event.key] + tabs.length) % tabs.length], true);
});

// Theme: follow the system until the user picks one with the toggle.

const themeToggle = $('#theme-toggle');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
}

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Private windows can refuse storage; the toggle still works for this visit.
  }
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  if (!savedTheme()) applyTheme(event.matches ? 'dark' : 'light');
});

// The debounced save could lose the last keystroke if the tab closes right away.
window.addEventListener('pagehide', () => saveState(state));

applyTheme(document.documentElement.dataset.theme);
setupHelp(currentScheme);
renderAll();
