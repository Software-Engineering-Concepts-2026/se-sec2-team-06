function node(tagName, className = '', text) {
  const value = document.createElement(tagName);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
}

function svgNode(tagName, attributes = {}) {
  const value = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  for (const [name, attribute] of Object.entries(attributes)) value.setAttribute(name, String(attribute));
  return value;
}

function chart(title, description, role) {
  const section = node('section', 'dashboard-chart');
  section.dataset.chart = role;
  section.setAttribute('aria-labelledby', `${role}-title`);
  section.append(node('h3', 'dashboard-chart__title', title));
  section.querySelector('h3').id = `${role}-title`;
  section.append(node('p', 'dashboard-chart__description', description));
  return section;
}

function addEmpty(section, message) {
  const empty = node('p', 'dashboard-chart__empty', message);
  empty.dataset.role = 'chart-empty';
  section.append(empty);
}

function addSvg(section, role, title, height = 200) {
  const svg = svgNode('svg', {
    viewBox: `0 0 360 ${height}`,
    role: 'img',
    'aria-labelledby': `${role}-svg-title`,
    'aria-describedby': `${role}-svg-description`,
    class: 'dashboard-chart__visual',
  });
  const svgTitle = svgNode('title', { id: `${role}-svg-title` });
  svgTitle.textContent = title;
  const svgDescription = svgNode('desc', { id: `${role}-svg-description` });
  svg.append(svgTitle, svgDescription);
  section.append(svg);
  return svg;
}

function describeSvg(svg, description) {
  const svgDescription = svg.querySelector('desc');
  if (svgDescription) svgDescription.textContent = description;
}

function activityPeriodLabel(items) {
  const labels = items.map((item) => String(item?.label || ''));
  const weeklyLabels = labels.map((label) => label.match(/^(\d{4})-W(\d{2})$/));
  if (labels.length && weeklyLabels.every(Boolean)) {
    const first = weeklyLabels[0];
    const last = weeklyLabels.at(-1);
    const firstYear = Number(first[1]) + 543;
    const lastYear = Number(last[1]) + 543;
    if (firstYear === lastYear) {
      return `สัปดาห์ ${Number(first[2])}–${Number(last[2])} · ${firstYear}`;
    }
    return `สัปดาห์ ${Number(first[2])} · ${firstYear} – สัปดาห์ ${Number(last[2])} · ${lastYear}`;
  }

  const dates = labels.map((label) => {
    const match = label.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  });
  if (!dates.length || dates.some((date) => !date)) return 'ช่วงเวลาที่เลือก';

  const first = dates[0];
  const last = dates.at(-1);
  const monthYear = new Intl.DateTimeFormat('th-TH', { month: 'short', year: 'numeric' });
  const fullDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    return `${first.getDate()}–${last.getDate()} ${monthYear.format(last)}`;
  }
  return `${fullDate.format(first)} – ${fullDate.format(last)}`;
}

function activityChart(data = []) {
  const section = chart('จำนวนทำข้อสอบ', 'จำนวนครั้งที่ส่งคำตอบในแต่ละวันหรือสัปดาห์', 'quiz-activity');
  const items = Array.isArray(data) ? data : [];
  const counts = items.map((item) => Math.max(0, Number(item?.count) || 0));
  const maxCount = Math.max(0, ...counts);
  const totalAttempts = counts.reduce((sum, count) => sum + count, 0);
  const activeDays = counts.filter((count) => count > 0).length;
  const weekly = items.some((item) => /-W\d{2}$/.test(String(item?.label || '')));
  const periodUnit = weekly ? 'สัปดาห์' : 'วัน';

  const title = section.querySelector('.dashboard-chart__title');
  const description = section.querySelector('.dashboard-chart__description');
  const header = node('header', 'dashboard-chart__activity-header');
  const copy = node('div', 'dashboard-chart__activity-copy');
  copy.append(title, description);
  header.append(copy);
  section.prepend(header);

  const main = node('div', 'dashboard-chart__activity-main');
  const kpi = node('div', 'dashboard-chart__activity-kpi');
  const total = node('strong', 'dashboard-chart__activity-total', String(totalAttempts));
  total.dataset.role = 'quiz-activity-total';
  kpi.append(total, node('span', '', 'ครั้งทั้งหมด'));
  const period = node('small', 'dashboard-chart__activity-period', activityPeriodLabel(items));
  period.dataset.role = 'quiz-activity-period';
  kpi.append(period);
  main.append(kpi);

  const plot = node('div', 'dashboard-chart__activity-plot');
  const svg = addSvg(plot, 'quiz-activity', 'จำนวนครั้งที่ทำข้อสอบตามช่วงเวลา', 216);
  const baseline = 172;
  svg.append(svgNode('line', { x1: 24, y1: baseline, x2: 344, y2: baseline, class: 'dashboard-chart__axis' }));
  main.append(plot);
  section.append(main);

  if (!items.length || maxCount === 0) {
    describeSvg(svg, 'ยังไม่มีข้อมูลการทำข้อสอบในช่วงนี้');
    addEmpty(plot, 'ยังไม่มีข้อมูลการทำข้อสอบในช่วงนี้');
  } else {
    describeSvg(svg, 'กราฟแท่งแสดงจำนวนครั้งทำข้อสอบในแต่ละช่วงเวลา โดยมีค่าบนแท่งและรายการอ่านหน้าจอเพิ่มเติม');

    const slot = 320 / items.length;
    const barWidth = Math.min(30, slot * 0.58);
    const values = node('ul', 'dashboard-chart__data-list dashboard-chart__data-list--activity visually-hidden');
    values.setAttribute('aria-label', 'จำนวนครั้งทำข้อสอบในแต่ละวัน');
    items.forEach((item, index) => {
      const count = counts[index];
      const height = Math.max(2, (count / maxCount) * 116);
      const x = 24 + (index * slot) + ((slot - barWidth) / 2);
      const bar = svgNode('rect', {
        x,
        y: baseline - height,
        width: barWidth,
        height,
        rx: 6,
        class: 'dashboard-chart__bar',
      });
      bar.setAttribute('data-count', String(count));
      svg.append(bar);

      if (count > 0) {
        const value = svgNode('text', {
          x: x + barWidth / 2,
          y: Math.max(14, baseline - height - 8),
          class: 'dashboard-chart__activity-value',
          'text-anchor': 'middle',
        });
        value.textContent = String(count);
        value.dataset.role = 'quiz-activity-bar-value';
        svg.append(value);
      }

      const label = String(item?.label || '');
      const dateMatch = label.match(/^\d{4}-\d{2}-(\d{2})$/);
      const weekMatch = label.match(/-W(\d{2})$/);
      const axisLabel = svgNode('text', {
        x: x + barWidth / 2,
        y: baseline + 18,
        class: 'dashboard-chart__axis-label',
        'text-anchor': 'middle',
      });
      axisLabel.textContent = dateMatch ? String(Number(dateMatch[1])) : (weekMatch ? `W${weekMatch[1]}` : label.slice(-3));
      svg.append(axisLabel);
      const listItem = node('li', '', `${label}: ${count} ครั้ง`);
      listItem.dataset.role = 'chart-data-value';
      values.append(listItem);
    });
    section.append(values);
  }

  const summary = node('p', 'dashboard-chart__summary dashboard-chart__activity-footer');
  const legend = node('span', 'dashboard-chart__activity-legend');
  legend.append(node('span', 'dashboard-chart__summary-dot'), node('span', '', 'จำนวนครั้งที่ทำข้อสอบ'));
  const activeDaySummary = node('span', '', `ทำข้อสอบ ${activeDays} จาก ${items.length} ${periodUnit}`);
  activeDaySummary.dataset.role = 'quiz-activity-active-days';
  summary.append(
    legend,
    activeDaySummary,
  );
  section.append(summary);
  return section;
}

function taskChart(data = {}) {
  const section = chart('สถานะงาน', 'สัดส่วนงานที่ยังไม่เริ่ม กำลังทำ และเสร็จแล้ว', 'task-status');
  const statuses = [
    ['not_started', 'ยังไม่เริ่ม', 'not-started'],
    ['in_progress', 'กำลังทำ', 'in-progress'],
    ['completed', 'เสร็จแล้ว', 'completed'],
  ].map(([key, label, color]) => ({ label, color, count: Math.max(0, Number(data?.[key]) || 0) }));
  const total = statuses.reduce((sum, item) => sum + item.count, 0);
  const svg = addSvg(section, 'task-status', 'สัดส่วนสถานะงาน', 200);
  const centerX = 180;
  const circumference = 2 * Math.PI * 58;
  const circleBase = svgNode('circle', {
    cx: centerX, cy: 100, r: 58,
    class: 'dashboard-chart__donut-track',
  });
  svg.append(circleBase);
  let offset = 0;
  if (total > 0) {
    describeSvg(svg, 'กราฟวงแหวนแสดงสัดส่วนงานแต่ละสถานะ โดยมีชื่อสถานะและจำนวนงานในรายการถัดไป');
    for (const item of statuses) {
      if (!item.count) continue;
      const segment = circumference * item.count / total;
      const circle = svgNode('circle', {
        cx: centerX,
        cy: 100,
        r: 58,
        class: `dashboard-chart__donut-segment dashboard-chart__donut-segment--${item.color}`,
        'stroke-dasharray': `${segment} ${circumference - segment}`,
        'stroke-dashoffset': -offset,
        transform: `rotate(-90 ${centerX} 100)`,
      });
      svg.append(circle);
      offset += segment;
    }
    const totalLabel = svgNode('text', { x: centerX, y: 96, class: 'dashboard-chart__donut-total' });
    totalLabel.textContent = String(total);
    const caption = svgNode('text', { x: centerX, y: 118, class: 'dashboard-chart__donut-caption' });
    caption.textContent = 'งานทั้งหมด';
    svg.append(totalLabel, caption);

    const legend = node('ul', 'dashboard-chart__legend');
    for (const item of statuses) {
      const line = node('li', `dashboard-chart__legend-item dashboard-chart__legend-item--${item.color}`);
      line.dataset.role = 'chart-data-value';
      line.append(node('span', 'dashboard-chart__legend-dot'), node('span', '', item.label), node('strong', '', String(item.count)));
      legend.append(line);
    }
    section.append(legend);
  } else {
    describeSvg(svg, 'ยังไม่มีงานที่บันทึกไว้');
    addEmpty(section, 'ยังไม่มีงานที่บันทึกไว้');
  }
  return section;
}

function horizontalChart({
  title,
  description,
  role,
  items = [],
  valueText,
  emptyMessage,
  colorClass,
  limit = 6,
  sortOrder = 'desc',
  allowZeroCounts = false,
  detailText,
  rowHeight = 42,
}) {
  const section = chart(title, description, role);
  const rows = [...(Array.isArray(items) ? items : [])]
    .sort((left, right) => {
      const difference = (Number(left?.count) || 0) - (Number(right?.count) || 0);
      return sortOrder === 'asc' ? difference : -difference;
    });
  const shown = rows.slice(0, limit);
  const maxCount = Math.max(0, ...shown.map((item) => Number(item?.count) || 0));
  const svg = addSvg(section, role, title, Math.max(90, shown.length * rowHeight + 12));
  if (!shown.length || (maxCount === 0 && !allowZeroCounts)) {
    describeSvg(svg, emptyMessage);
    addEmpty(section, emptyMessage);
    return section;
  }

  const values = node('ul', 'dashboard-chart__data-list dashboard-chart__data-list--horizontal visually-hidden');
  values.setAttribute('aria-label', `${title} รายละเอียดข้อมูล`);
  describeSvg(svg, `กราฟแท่งสรุป${title} โดยชื่อและค่าของแต่ละรายการอยู่ในรายการอ่านหน้าจอที่ตามมา`);
  shown.forEach((item, index) => {
    const label = String(item?.tag_name || 'ไม่ระบุแท็ก');
    const count = Math.max(0, Number(item?.count) || 0);
    const y = index * rowHeight + 4;
    const text = svgNode('text', { x: 2, y: y + 12, class: 'dashboard-chart__row-label' });
    text.textContent = label.length > 28 ? `${label.slice(0, 27)}…` : label;
    const detail = detailText ? svgNode('text', { x: 2, y: y + 25, class: 'dashboard-chart__row-detail' }) : null;
    if (detail) detail.textContent = detailText(item);
    const barTop = y + (detail ? 30 : 18);
    const track = svgNode('rect', { x: 2, y: barTop, width: 302, height: 8, rx: 4, class: 'dashboard-chart__track' });
    const bar = svgNode('rect', {
      x: 2,
      y: barTop,
      width: Math.max(4, (count / (maxCount || 1)) * 302),
      height: 8,
      rx: 4,
      class: `dashboard-chart__bar ${colorClass || ''}`,
    });
    if (item?.color) bar.dataset.color = String(item.color);
    const number = svgNode('text', { x: 350, y: barTop + 8, class: 'dashboard-chart__row-number' });
    number.textContent = valueText(item);
    svg.append(text);
    if (detail) svg.append(detail);
    svg.append(track, bar, number);

    const details = detailText ? ` · ${detailText(item)}` : '';
    const listItem = node('li', '', `${label}: ${valueText(item)}${details}`);
    listItem.dataset.role = 'chart-data-value';
    values.append(listItem);
  });
  section.append(values);
  if (rows.length > shown.length) {
    section.append(node('p', 'dashboard-chart__footnote', `แสดง ${shown.length} จาก ${rows.length} แท็ก`));
  }
  return section;
}

function weakTopicsChart(items = []) {
  const sorted = [...(Array.isArray(items) ? items : [])]
    .sort((left, right) => (Number(left?.average_percent) || 0) - (Number(right?.average_percent) || 0))
    .map((item) => ({ ...item, count: Number(item?.average_percent) || 0 }));
  return horizontalChart({
    title: 'หัวข้อที่ควรทบทวน',
    description: 'ค่าเฉลี่ยคะแนนตามแท็กจากผลข้อสอบที่ส่งแล้ว',
    role: 'weak-topics',
    items: sorted,
    valueText: (item) => `${Number(item?.average_percent) || 0}%`,
    emptyMessage: 'ทำข้อสอบที่ติดแท็กก่อน แล้วระบบจะแสดงหัวข้อที่ควรทบทวน',
    colorClass: 'dashboard-chart__bar--weak',
    limit: 5,
    sortOrder: 'asc',
    allowZeroCounts: true,
    detailText: (item) => `${Number(item?.attempt_count) || 0} ครั้ง`,
    rowHeight: 48,
  });
}

export function renderDashboardCharts(overview = {}) {
  const charts = node('div', 'dashboard-chart-grid');
  charts.append(
    activityChart(overview.quiz_activity),
    taskChart(overview.task_status),
    horizontalChart({
      title: 'คลังเอกสารตามแท็ก',
      description: 'จำนวนเอกสารในแต่ละวิชาและหัวข้อ',
      role: 'document-tags',
      items: overview.documents_by_tag,
      valueText: (item) => String(Number(item?.count) || 0),
      emptyMessage: 'ยังไม่มีเอกสารในคลัง',
      colorClass: 'dashboard-chart__bar--documents',
      limit: 6,
    }),
    weakTopicsChart(overview.topics_to_review),
  );
  return charts;
}
