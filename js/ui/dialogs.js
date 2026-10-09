import { $, escapeHtml, icon } from './dom.js';

const TOAST_TIME = 3200;

export function toast(message, tone = 'success') {
  const region = $('#toasts');
  const item = document.createElement('div');
  item.className = `toast toast--${tone}`;
  item.innerHTML = `${icon(tone === 'error' ? 'alert' : 'check')}<span>${escapeHtml(message)}</span>`;
  region.append(item);

  while (region.children.length > 3) region.firstElementChild.remove();

  setTimeout(() => {
    item.classList.add('is-leaving');
    item.addEventListener('transitionend', () => item.remove(), { once: true });
    setTimeout(() => item.remove(), 400);
  }, TOAST_TIME);
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  const dialog = $('#confirm-dialog');
  const okButton = $('#confirm-ok');
  $('#confirm-title').textContent = title;
  $('#confirm-message').textContent = message;
  okButton.textContent = confirmLabel;
  okButton.classList.toggle('btn--danger-solid', danger);
  dialog.returnValue = '';

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {
      once: true,
    });
    dialog.showModal();
    okButton.focus();
  });
}

function renderSchemeHelp(scheme) {
  $('#help-scheme-title').textContent = `Grade points in ${scheme.name}`;
  $('#help-grades').innerHTML = scheme.grades
    .map(
      ({ grade, points, fail, label }) =>
        `<span class="grade-chip${fail ? ' is-fail' : ''}" title="${escapeHtml(label ?? '')}">` +
        `<b>${escapeHtml(grade)}</b>${points}</span>`,
    )
    .join('');

  const percentage = $('#help-percentage');
  if (scheme.percentage) {
    percentage.innerHTML =
      `Equivalent percentage for this scheme: ` +
      `<code class="formula-inline">${escapeHtml(scheme.percentage.formula)}</code>.`;
  } else {
    percentage.textContent = 'This scale has no official percentage conversion, so none is shown.';
  }
}

export function setupHelp(getScheme) {
  const dialog = $('#help-dialog');
  $('#help-open').addEventListener('click', () => {
    renderSchemeHelp(getScheme());
    dialog.showModal();
  });

  dialog.addEventListener('click', (event) => {
    // A click on the backdrop lands on the <dialog> element itself.
    if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
  });
}
