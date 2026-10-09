import { classify, gradeCourse, round, toPercentage } from '../calc.js';
import { DASH, formatCredits, formatGpa, formatPercent } from '../format.js';
import { $, escapeHtml } from './dom.js';
import { staticChart } from './chart.js';

const cell = (value, className = '') =>
  `<td${className ? ` class="${className}"` : ''}>${value}</td>`;

function courseTable(semester, result, number, scheme) {
  const rows = semester.courses
    .map((course, i) => {
      const graded = gradeCourse(course, scheme);
      return `<tr>
        ${cell(i + 1)}
        ${cell(escapeHtml(course.name.trim() || `Course ${i + 1}`), 'text course-name')}
        ${cell(course.credits === '' ? DASH : escapeHtml(course.credits))}
        ${cell(escapeHtml(course.grade || DASH), graded?.failed ? 'fail' : '')}
        ${cell(graded ? graded.points : DASH)}
        ${cell(graded ? round(graded.credits * graded.points) : DASH)}
      </tr>`;
    })
    .join('');

  return `<section class="report__semester">
    <h2>Semester ${number}</h2>
    <table>
      <thead><tr><th>No.</th><th class="text">Course</th><th>Credits</th><th>Grade</th><th>Grade points</th><th>Credit points</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="2" class="text">SGPA ${formatGpa(result.gpa)}</td>
        <td>${formatCredits(result.credits)}</td><td></td><td></td>
        <td>${formatCredits(result.creditPoints)}</td>
      </tr></tfoot>
    </table>
  </section>`;
}

function semesterSummary(analysis) {
  const rows = analysis.semesters
    .map(
      (s, i) =>
        `<tr>${cell(i + 1)}${cell(formatCredits(s.credits))}${cell(formatGpa(s.gpa))}${cell(formatGpa(s.cgpa))}</tr>`,
    )
    .join('');
  return `<h2>Semester summary</h2>
    <table>
      <thead><tr><th>Semester</th><th>Credits</th><th>SGPA</th><th>CGPA after semester</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function renderReport(state, analysis, scheme, points) {
  const { total } = analysis;
  const quick = state.mode === 'quick';
  const percent = toPercentage(total.gpa, scheme);
  const degreeClass = classify(total.gpa, quick ? 0 : total.backlogs, scheme);
  const date = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const facts = [
    ['Credits', formatCredits(total.credits)],
    quick ? ['Semesters', analysis.completed] : ['Credits earned', formatCredits(total.earned)],
    quick ? null : ['Backlogs', total.backlogs],
    scheme.percentage ? ['Percentage', formatPercent(percent)] : null,
    scheme.classify ? ['Class', degreeClass ?? DASH] : null,
  ].filter(Boolean);

  const report = $('#report');
  report.innerHTML = `
    <header class="report__head">
      <div>
        <h1>Grade Statement</h1>
        <p>${escapeHtml(scheme.name)} &middot; Printed on ${date}</p>
      </div>
      <div class="report__cgpa"><span>CGPA</span><strong>${formatGpa(total.gpa)}</strong></div>
    </header>
    <dl class="report__facts" style="grid-template-columns: repeat(${facts.length}, 1fr)">
      ${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
    </dl>
    ${quick ? '' : state.semesters.map((s, i) => courseTable(s, analysis.semesters[i], i + 1, scheme)).join('')}
    ${semesterSummary(analysis)}
    <div class="report__chart">${points.length > 1 ? '<h2>SGPA trend</h2>' : ''}</div>
    <p class="report__foot">
      SGPA = &Sigma;(credits &times; grade points) / &Sigma;credits. CGPA uses the same formula over all
      semesters.${scheme.percentage ? ` Percentage = ${escapeHtml(scheme.percentage.formula)}.` : ''}
      ${quick ? 'Computed from semester SGPAs entered directly.' : ''}
      <span class="report__disclaimer">Prepared by the student from their own grades with CGPA Calculator. This is not a document issued by any university.</span>
    </p>`;

  if (points.length > 1) $('.report__chart', report).append(staticChart(points, scheme.max));
}
