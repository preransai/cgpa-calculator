import { classify, toPercentage } from '../calc.js';
import { DASH, formatCredits, formatGpa, formatPercent } from '../format.js';
import { $, debounce, escapeHtml } from './dom.js';

function statsFor(state, analysis, scheme) {
  const { total, semesters, completed } = analysis;
  if (state.mode === 'quick') {
    const gpas = semesters.map((s) => s.gpa).filter((gpa) => gpa !== null);
    return [
      { label: 'Credits', value: formatCredits(total.credits) },
      { label: 'Semesters', value: String(completed) },
      { label: 'Best', value: gpas.length ? formatGpa(Math.max(...gpas)) : DASH },
      { label: 'Lowest', value: gpas.length ? formatGpa(Math.min(...gpas)) : DASH },
    ];
  }
  const counted = scheme.excludeFailed ? 'Credits counted' : 'Total credits';
  return [
    { label: 'Credits', value: formatCredits(total.credits), title: counted },
    { label: 'Earned', value: formatCredits(total.earned), title: 'Credits from passed courses' },
    { label: 'Backlogs', value: String(total.backlogs), alert: total.backlogs > 0 },
    { label: 'Semesters', value: String(completed), title: 'Semesters with results' },
  ];
}

const announce = debounce((text) => {
  $('#live-summary').textContent = text;
}, 700);

export function renderSummary(state, analysis, scheme) {
  const cgpa = analysis.total.gpa;
  const percent = toPercentage(cgpa, scheme);
  const degreeClass = classify(cgpa, state.mode === 'quick' ? 0 : analysis.total.backlogs, scheme);

  $('#scheme-chip').textContent = scheme.name;
  $('#cgpa-value').textContent = formatGpa(cgpa);
  $('#cgpa-scale').textContent = `out of ${scheme.max}`;

  const ring = $('#cgpa-ring');
  // Where the drafting scale's long ticks fall: one per grade point.
  ring.style.setProperty('--units', scheme.max);
  ring.classList.toggle('is-empty', cgpa === null);
  const share = cgpa === null ? 0 : Math.min(100, (cgpa / scheme.max) * 100);
  ring.querySelector('.ring__value').style.strokeDasharray = `${share} 100`;

  $('#percent-fact').hidden = !scheme.percentage;
  $('#percent-value').textContent = formatPercent(percent);
  $('#percent-formula').textContent = scheme.percentage?.formula ?? '';

  $('#class-fact').hidden = !scheme.classify;
  $('.summary').classList.toggle('summary--ring-only', !scheme.percentage && !scheme.classify);
  const classValue = $('#class-value');
  classValue.textContent = degreeClass ?? DASH;
  // "First Class with Distinction" is lettered a size smaller (CSS) so it
  // stays on two lines in the facts cell instead of stretching the block.
  classValue.classList.toggle('is-long', (degreeClass ?? '').length > 14);
  $('#class-note').textContent = scheme.classify
    ? `${scheme.classRule}${state.mode === 'quick' ? ', if you have no backlogs' : ''}`
    : '';

  $('#stats').innerHTML = statsFor(state, analysis, scheme)
    .map(
      ({ label, value, alert, title }) =>
        `<div class="stat${alert ? ' is-alert' : ''}"${title ? ` title="${escapeHtml(title)}"` : ''}>` +
        `<dt>${label}</dt><dd>${value}</dd></div>`,
    )
    .join('');

  if (cgpa === null) {
    announce('No CGPA yet. Add credits and grades to see it.');
  } else {
    const parts = [`CGPA ${formatGpa(cgpa)} out of ${scheme.max}`];
    if (percent !== null) parts.push(`${formatPercent(percent)}`);
    parts.push(`${formatCredits(analysis.total.credits)} credits`);
    if (state.mode !== 'quick' && analysis.total.backlogs) {
      parts.push(`${analysis.total.backlogs} backlog${analysis.total.backlogs === 1 ? '' : 's'}`);
    }
    announce(`${parts.join(', ')}.`);
  }
}
