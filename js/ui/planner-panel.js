import { formatCredits, formatGpa, plural } from '../format.js';
import { planTarget } from '../planner.js';
import { $, icon, setInvalid } from './dom.js';

const INPUTS = {
  target: '#plan-target',
  totalSemesters: '#plan-semesters',
  semesterCredits: '#plan-credits',
};

export function fillPlannerInputs(state, scheme) {
  for (const [key, selector] of Object.entries(INPUTS)) $(selector).value = state.planner[key];
  $('#plan-target').max = scheme.max;
}

function meter(plan, max, cgpa) {
  const fill = Math.min(100, (plan.required / max) * 100);
  const mark =
    cgpa === null
      ? ''
      : `<span class="plan-meter__mark" style="left:${(cgpa / max) * 100}%"></span>`;
  return `<div class="plan-meter" aria-hidden="true" data-max="${max}" style="--units: ${max}"><span class="plan-meter__fill" style="width:${fill}%"></span>${mark}</div>`;
}

function describe(plan, max) {
  const rest =
    plan.remaining === 1 ? 'the last semester' : `the ${plan.remaining} remaining semesters`;
  const cgpa = formatGpa(plan.cgpa);
  const target = formatGpa(plan.target);

  switch (plan.status) {
    case 'invalid':
      return { icon: 'info', label: 'Check the inputs', figure: '', text: plan.reason };
    case 'finished':
      return {
        icon: plan.achieved ? 'check' : 'info',
        label: 'No semesters left',
        figure: cgpa,
        text: plan.achieved
          ? `You finish at ${cgpa}, which meets the ${target} target.`
          : 'Every semester is already entered. Raise "Total semesters" to plan ahead.',
      };
    case 'impossible':
      return {
        icon: 'alert',
        label: 'Out of reach',
        figure: formatGpa(plan.required),
        text: `That would need more than ${formatGpa(max)} in ${rest}. The best you can finish with is ${formatGpa(plan.best)}.`,
      };
    case 'reached':
      return {
        icon: 'check',
        label: 'Already on target',
        figure: formatGpa(plan.required),
        text:
          plan.required === 0
            ? `At ${cgpa} you stay above ${target} whatever happens in ${rest}.`
            : `You are at ${cgpa}. Averaging ${formatGpa(plan.required)} or more in ${rest} keeps you at ${target}.`,
      };
    default: {
      let text = `Average this over ${rest} to finish at ${target}.`;
      if (plan.cgpa !== null) {
        const gap = plan.required - plan.cgpa;
        const direction = gap >= 0 ? 'above' : 'below';
        text += ` That is ${formatGpa(Math.abs(gap))} ${direction} your current CGPA.`;
      }
      return { icon: 'target', label: 'SGPA you need', figure: formatGpa(plan.required), text };
    }
  }
}

export function renderPlan(state, analysis, scheme) {
  const { total, completed } = analysis;
  const plan = planTarget({
    current: { credits: total.credits, creditPoints: total.creditPoints, semesters: completed },
    max: scheme.max,
    ...state.planner,
  });

  for (const [key, selector] of Object.entries(INPUTS)) {
    setInvalid($(selector), plan.status === 'invalid' && plan.field === key, plan.reason);
  }

  const view = describe(plan, scheme.max);
  const showMeter = ['possible', 'reached', 'impossible'].includes(plan.status);
  const output = $('#plan-result');
  output.className = `plan-result plan-result--${plan.status}`;
  output.innerHTML = `
    <span class="plan-result__label">${icon(view.icon)}${view.label}</span>
    ${view.figure ? `<div class="plan-result__figure">${view.figure}<small>/ ${scheme.max}</small></div>` : ''}
    <p class="plan-result__text">${view.text}</p>
    ${showMeter ? meter(plan, scheme.max, plan.cgpa) : ''}
    ${
      plan.status === 'invalid'
        ? ''
        : `<p class="plan-result__meta">
            <span>Done: ${plural(completed, 'semester')}, ${formatCredits(total.credits)} credits</span>
            <span>Left: ${plural(Math.max(plan.remaining, 0), 'semester')}, ${formatCredits(plan.remainingCredits)} credits</span>
          </p>`
    }`;
}
