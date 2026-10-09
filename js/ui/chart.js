import { formatCredits, formatGpa } from '../format.js';
import { escapeHtml } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN = { top: 14, right: 12, bottom: 40, left: 46 };

function add(parent, name, attrs = {}, text) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  parent?.append(el);
  return el;
}

// Starting the axis at zero would squash a 7.8 to 9.2 range into a flat line,
// so the floor sits one step below the lowest value.
function yScale(values, max) {
  const step = max > 5 ? 1 : 0.5;
  const min = Math.max(0, Math.floor(Math.min(...values, max) / step) * step - step);
  const labelStep = (max - min) / step > 6 ? step * 2 : step;
  const ticks = [];
  for (let value = max; value >= min - 1e-9; value -= labelStep) {
    ticks.push(Number(value.toFixed(2)));
  }
  return { min, ticks, step };
}

const linePath = (coords) => coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');

function drawChart(points, { width, height, max, interactive }) {
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const { min, ticks, step } = yScale(
    points.flatMap((p) => [p.sgpa, p.cgpa]),
    max,
  );
  const band = plotW / points.length;
  const x = (i) => MARGIN.left + band * (i + 0.5);
  const y = (value) => MARGIN.top + plotH * (1 - (value - min) / (max - min));
  const baseline = MARGIN.top + plotH;

  const svg = add(null, 'svg', { viewBox: `0 0 ${width} ${height}`, width, height });

  // Real graph paper inside the plot: five small squares per grade-point step,
  // a stronger line every fifth, square cells across the whole width.
  const minor = step / 5;
  const cell = plotH / ((max - min) / minor);
  const right = width - MARGIN.right;
  const paper = add(svg, 'g', { class: 'chart-paper', 'aria-hidden': 'true' });
  const rows = Math.round((max - min) / minor);
  for (let i = 0; i <= rows; i++) {
    const py = y(min + i * minor);
    add(paper, 'line', {
      class: i % 5 ? '' : 'is-major',
      x1: MARGIN.left,
      x2: right,
      y1: py,
      y2: py,
    });
  }
  for (let i = 0, px = MARGIN.left; px <= right + 0.5; i++, px = MARGIN.left + i * cell) {
    add(paper, 'line', {
      class: i % 5 ? '' : 'is-major',
      x1: px,
      x2: px,
      y1: MARGIN.top,
      y2: baseline,
    });
  }

  const grid = add(svg, 'g', { class: 'chart-grid chart-axis' });
  for (const tick of ticks) {
    add(grid, 'line', { x1: MARGIN.left, x2: width - MARGIN.right, y1: y(tick), y2: y(tick) });
    const label = max > 5 ? tick : tick.toFixed(1);
    add(
      grid,
      'text',
      { x: MARGIN.left - 10, y: y(tick), dy: '0.35em', 'text-anchor': 'end' },
      label,
    );
  }

  // Inked axes, like a plotted lab-record graph.
  add(svg, 'path', {
    class: 'chart-frame',
    d: `M${MARGIN.left},${MARGIN.top} V${baseline} H${right}`,
  });

  const axis = add(svg, 'g', { class: 'chart-axis' });
  points.forEach((point, i) => {
    const label = band >= 46 ? `Sem ${point.number}` : `S${point.number}`;
    add(axis, 'text', { x: x(i), y: baseline + 18, 'text-anchor': 'middle' }, label);
  });

  const middleY = MARGIN.top + plotH / 2;
  add(
    svg,
    'text',
    {
      class: 'chart-label',
      transform: `translate(12 ${middleY}) rotate(-90)`,
      'text-anchor': 'middle',
    },
    'Grade points',
  );
  add(
    svg,
    'text',
    { class: 'chart-label', x: MARGIN.left + plotW / 2, y: height - 2, 'text-anchor': 'middle' },
    'Semester',
  );
  add(svg, 'text', { class: 'chart-scale', x: 0, y: height - 2 }, `1 sq = ${minor.toFixed(1)} GP`);

  const sgpaCoords = points.map((p, i) => [x(i), y(p.sgpa)]);
  const cgpaCoords = points.map((p, i) => [x(i), y(p.cgpa)]);

  if (points.length > 1) {
    add(svg, 'path', { class: 'chart-line chart-line--cgpa', d: linePath(cgpaCoords) });
    add(svg, 'path', { class: 'chart-line chart-line--sgpa', d: linePath(sgpaCoords) });
  }

  const guide = add(svg, 'line', {
    class: 'chart-guide',
    y1: MARGIN.top,
    y2: baseline,
    visibility: 'hidden',
  });

  const dots = points.map((point, i) => {
    // The running CGPA is plotted as a cross, the SGPA as a ring.
    const cx = x(i);
    const cy = y(point.cgpa);
    const k = 3.2;
    add(svg, 'path', {
      class: 'chart-dot--cgpa',
      d: `M${cx - k},${cy - k} l${2 * k},${2 * k} m0,${-2 * k} l${-2 * k},${2 * k}`,
    });
    const dot = add(svg, 'circle', { class: 'chart-dot', cx: x(i), cy: y(point.sgpa), r: 4.5 });
    if (interactive) {
      dot.setAttribute('tabindex', 0);
      dot.setAttribute('role', 'img');
      dot.dataset.index = i;
      dot.setAttribute(
        'aria-label',
        `Semester ${point.number}: SGPA ${formatGpa(point.sgpa)}, CGPA ${formatGpa(point.cgpa)}`,
      );
    }
    return dot;
  });

  // Invisible full-height columns, so hovering anywhere above a semester works.
  if (interactive) {
    points.forEach((_, i) => {
      add(svg, 'rect', {
        class: 'chart-hit',
        x: x(i) - band / 2,
        y: MARGIN.top,
        width: band,
        height: plotH,
        'data-index': i,
      });
    });
  }

  return { svg, dots, guide, x, y };
}

export function staticChart(points, max) {
  return drawChart(points, { width: 680, height: 220, max, interactive: false }).svg;
}

function tooltipHtml(point) {
  const row = (swatch, label, value) =>
    `<div class="tip-row"><span class="${swatch}"></span><span>${label}</span><b>${value}</b></div>`;
  return `<strong>Semester ${point.number}</strong>
    ${row('swatch', 'SGPA', formatGpa(point.sgpa))}
    ${row('swatch swatch--cgpa', 'CGPA', formatGpa(point.cgpa))}
    ${row('', 'Credits', escapeHtml(formatCredits(point.credits)))}`;
}

export function createTrendChart(container, { height = 230 } = {}) {
  let points = [];
  let max = 10;
  let chart = null;
  let width = 0;

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;

  function hide() {
    tooltip.hidden = true;
    chart?.guide.setAttribute('visibility', 'hidden');
    chart?.dots.forEach((dot) => dot.classList.remove('is-active'));
  }

  function show(index) {
    const point = points[index];
    if (!point || !chart) return;
    const px = chart.x(index);
    const top = Math.min(chart.y(point.sgpa), chart.y(point.cgpa));
    const bottom = Math.max(chart.y(point.sgpa), chart.y(point.cgpa));

    chart.guide.setAttribute('x1', px);
    chart.guide.setAttribute('x2', px);
    chart.guide.setAttribute('visibility', 'visible');
    chart.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));

    tooltip.innerHTML = tooltipHtml(point);
    tooltip.hidden = false;
    // Sit beside the crosshair rather than on top of it, so the two points
    // being described stay visible. Flip to the left near the right edge,
    // but never over the y-axis numbers and title (left of MARGIN.left).
    const { offsetWidth: w, offsetHeight: h } = tooltip;
    const gap = 14;
    const clampTop = (value) => Math.min(Math.max(value, 0), height - h);
    let left;
    let tipTop;
    if (px + gap + w <= width) {
      left = px + gap;
    } else if (px - gap - w >= MARGIN.left) {
      left = px - gap - w;
    }
    if (left !== undefined) {
      tipTop = clampTop((top + bottom) / 2 - h / 2);
    } else {
      // No room beside it (a narrow chart, a point near the middle): centre
      // the slip on the crosshair inside the plot, above the points if it
      // fits, else below them, so the points stay visible either way.
      left = Math.max(MARGIN.left, Math.min(px - w / 2, width - w));
      const above = top - gap - h;
      const below = bottom + gap;
      if (above >= 0) tipTop = above;
      else if (below + h <= height) tipTop = below;
      else tipTop = clampTop(top > height - bottom ? above : below);
    }
    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = `${tipTop}px`;
  }

  function render() {
    width = Math.round(container.clientWidth);
    hide();
    if (!points.length) {
      chart = null;
      container.innerHTML =
        '<p class="chart__empty"><span>Your SGPA trend shows up here once a semester has grades.</span></p>';
      return;
    }
    // The planner tab hides the chart; it is redrawn when it becomes visible.
    if (width < 50) return;
    chart = drawChart(points, { width, height, max, interactive: true });
    const first = points[0];
    const last = points.at(-1);
    chart.svg.setAttribute('role', 'group');
    chart.svg.setAttribute(
      'aria-label',
      `SGPA trend over ${points.length} semesters, from ${formatGpa(first.sgpa)} to ` +
        `${formatGpa(last.sgpa)}. CGPA now ${formatGpa(last.cgpa)}.`,
    );
    container.replaceChildren(chart.svg, tooltip);
  }

  container.addEventListener('pointermove', (event) => {
    const index = event.target.closest?.('.chart-hit')?.dataset.index;
    if (index !== undefined) show(Number(index));
  });
  container.addEventListener('pointerleave', hide);
  container.addEventListener('focusin', (event) => {
    if (event.target.classList.contains('chart-dot')) show(Number(event.target.dataset.index));
  });
  container.addEventListener('focusout', hide);
  container.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !chart) return;
    const current = chart.dots.indexOf(document.activeElement);
    if (current === -1) return;
    const next = current + (event.key === 'ArrowRight' ? 1 : -1);
    chart.dots[Math.min(Math.max(next, 0), chart.dots.length - 1)].focus();
    event.preventDefault();
  });

  new ResizeObserver(() => {
    if (Math.round(container.clientWidth) !== width) render();
  }).observe(container);

  return {
    update(nextPoints, nextMax) {
      points = nextPoints;
      max = nextMax;
      render();
    },
  };
}
