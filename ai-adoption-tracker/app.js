/* ==========================================================================
   AI Adoption Follow-Through Tracker
   --------------------------------------------------------------------------
   Plain JavaScript. No libraries, no server, no external services.
   All data is stored in this browser's localStorage under STORE_KEY.
   Use the Data page to download a backup file and restore it later.
   ========================================================================== */
'use strict';

(function () {
  /* ------------------------------------------------------------------------
     1. Settings and fixed lists
     ------------------------------------------------------------------------ */
  const STORE_KEY = 'aftt-data-v1';
  // True when the app runs inside another page (for example a shared preview link).
  // Browsers block downloads and printing there, so the app says so instead.
  const EMBEDDED = (() => { try { return window.self !== window.top; } catch (_) { return true; } })();
  const DATA_VERSION = 1;
  const BACKUP_REMINDER_DAYS = 14;
  const SUSTAINED_WEEKS = 3; // "Used" this many weeks in a row = Sustained
  const FLAG_WEEKS = 2; // "Not used" this many completed weeks in a row = Flagged

  const BARRIER_TYPES = [
    { id: 'skills', label: 'Skills', hint: 'Does not yet know how to do it well.' },
    { id: 'time', label: 'Time', hint: 'Workload or schedule leaves no room for it.' },
    { id: 'access', label: 'Access', hint: 'Missing a license, login, data, or equipment.' },
    { id: 'workflow', label: 'Workflow design', hint: 'The process or system makes it awkward.' },
    { id: 'willingness', label: 'Willingness', hint: 'Doubts, low trust, or prefers the old way.' },
    { id: 'unknown', label: 'Unknown', hint: 'Not clear yet. Worth a conversation.' },
  ];

  const CHECKIN_STATUS = {
    used: { label: 'Used', icon: '✓' },
    partly: { label: 'Partly used', icon: '½' },
    not_used: { label: 'Not used', icon: '✕' },
  };

  const WEEK_STATE = {
    used: { label: 'Used', icon: '✓' },
    partly: { label: 'Partly used', icon: '½' },
    not_used: { label: 'Not used', icon: '✕' },
    missing: { label: 'No check-in recorded', icon: '?' },
    due: { label: 'Due today', icon: '•' },
    upcoming: { label: 'Upcoming', icon: '' },
  };

  const BEHAVIOR_STATUS = {
    flagged: { label: 'Missed 2+ weeks', tone: 'bad', rank: 0 },
    gap: { label: 'Check-in missing', tone: 'gap', rank: 1 },
    watch: { label: 'Watch', tone: 'warn', rank: 2 },
    not_started: { label: 'Not started', tone: 'neutral', rank: 3 },
    on_track: { label: 'On track', tone: 'good', rank: 4 },
    sustained: { label: 'Sustained', tone: 'good', rank: 5 },
    paused: { label: 'Paused', tone: 'neutral', rank: 6 },
  };

  const ASSESSMENTS = {
    on_track: { label: 'On track', tone: 'good' },
    at_risk: { label: 'At risk', tone: 'warn' },
    off_track: { label: 'Off track', tone: 'bad' },
  };

  const FLAG_DECISIONS = [
    { id: 'coach', label: 'Coach or support the owner' },
    { id: 'barrier', label: 'Remove a specific barrier' },
    { id: 'redesign', label: 'Redesign the workflow' },
    { id: 'escalate', label: 'Escalate to the sponsor' },
    { id: 'retire', label: 'Pause or retire this behavior' },
    { id: 'monitor', label: 'Keep monitoring' },
  ];

  const GAP_DECISIONS = [
    { id: 'request', label: 'Ask the owner to complete check-ins' },
    { id: 'reassign', label: 'Reassign the check-in owner' },
    { id: 'na', label: 'Not applicable (leave, holiday, etc.)' },
    { id: 'escalate', label: 'Escalate to the sponsor' },
    { id: 'monitor', label: 'Keep monitoring' },
  ];

  const IMPORT_COLUMNS = [
    'opportunity_id', 'process_name', 'opportunity_description', 'proposed_behavior',
    'suggested_owner', 'expected_outcome', 'outcome_measure', 'baseline', 'target', 'unit',
  ];

  /* ------------------------------------------------------------------------
     2. Small helpers
     ------------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => toISO(new Date());
  function parseISO(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  function addDays(s, n) {
    const d = parseISO(s);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(parseISO(s).getTime());
  function fmtDate(s) {
    if (!isISODate(s)) return '';
    return parseISO(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtShort(s) {
    if (!isISODate(s)) return '';
    return parseISO(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function fmtStamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const isNum = (v) => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
  function fmtVal(v, unit) {
    if (!isNum(v)) return '-';
    const s = Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (!unit) return s;
    return unit === '%' ? `${s}%` : `${s} ${unit}`;
  }
  const plural = (n, word, many) => `${n} ${n === 1 ? word : (many || word + 's')}`;
  const sum = (arr, fn) => arr.reduce((t, x) => t + fn(x), 0);
  const barrierLabel = (id) => (BARRIER_TYPES.find((t) => t.id === id) || BARRIER_TYPES[5]).label;
  const decisionLabel = (list, id) => (list.find((d) => d.id === id) || {}).label || 'No decision recorded';
  function safeUrl(s) {
    const v = String(s || '').trim();
    return /^https?:\/\/[^\s]+$/i.test(v) ? v : '';
  }
  function evidenceHtml(s) {
    const url = safeUrl(s);
    if (url) return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>`;
    return esc(s);
  }
  function setPath(obj, path, value) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
  }
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);

  /* ------------------------------------------------------------------------
     3. Saving and loading (browser localStorage)
     ------------------------------------------------------------------------ */
  function emptyDb() {
    return {
      version: DATA_VERSION,
      rollouts: [], behaviors: [], checkins: [], barriers: [], reviews: [], imports: [],
      meta: { createdAt: new Date().toISOString(), lastBackupAt: null, sample: false },
    };
  }

  function normalize(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.rollouts)) {
      throw new Error('This file does not look like a tracker backup.');
    }
    const out = emptyDb();
    ['rollouts', 'behaviors', 'checkins', 'barriers', 'reviews', 'imports'].forEach((k) => {
      out[k] = Array.isArray(d[k]) ? d[k].filter((x) => x && typeof x === 'object' && x.id) : [];
    });
    if (d.meta && typeof d.meta === 'object') out.meta = { ...out.meta, ...d.meta };
    out.behaviors.forEach((b) => {
      b.weeks = Math.max(1, Math.min(104, parseInt(b.weeks, 10) || 8));
      if (!isISODate(b.firstCheckin)) b.firstCheckin = todayISO();
    });
    return out;
  }

  let storageOK = true;
  function loadDb() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORE_KEY);
    } catch (e) {
      storageOK = false;
    }
    if (raw) {
      try {
        return normalize(JSON.parse(raw));
      } catch (e) {
        // Keep the unreadable copy rather than overwrite it.
        try { localStorage.setItem(`${STORE_KEY}-unreadable-${Date.now()}`, raw); } catch (_) { /* ignore */ }
      }
    }
    // A page can supply its own starting scenario in window.AFTT_SEED (a backup-format object).
    let sample = null;
    try { if (window.AFTT_SEED) sample = normalize(JSON.parse(JSON.stringify(window.AFTT_SEED))); } catch (_) { sample = null; }
    if (!sample) sample = buildSampleData();
    persist(sample);
    return sample;
  }

  function persist(data) {
    if (!storageOK) return false;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      toast('Could not save. Your browser storage may be full or blocked. Download a backup from the Data page.', 'error');
      return false;
    }
  }

  let db;
  function commit(message) {
    persist(db);
    render();
    if (message) toast(message);
  }

  /* ------------------------------------------------------------------------
     4. Fictional example data (dates are relative to today so it stays current)
     ------------------------------------------------------------------------ */
  function buildSampleData() {
    const t = todayISO();
    const now = new Date().toISOString();
    const d = emptyDb();
    d.meta.sample = true;

    const r1 = {
      id: uid(), tool: 'ClaimsPilot AI drafting assistant', team: 'Claims Intake, Harborview Mutual (fictional)',
      sponsor: 'Dana Whitfield, VP Claims Operations', launchDate: addDays(t, -46),
      purpose: 'Cut intake handling time while keeping first-notice-of-loss summaries accurate.', createdAt: now,
    };
    const r2 = {
      id: uid(), tool: 'MeetingMind call summaries', team: 'Regional Sales, Harborview Mutual (fictional)',
      sponsor: 'Elena Brooks, Director of Sales', launchDate: addDays(t, -32),
      purpose: 'Complete CRM notes after every client call without adding admin time.', createdAt: now,
    };
    d.rollouts.push(r1, r2);

    const mk = (r, o) => {
      const b = { id: uid(), rolloutId: r.id, paused: false, source: 'manual', sourceId: '', current: '', createdAt: now, ...o };
      d.behaviors.push(b);
      return b;
    };
    const f1 = addDays(t, -39);
    const f2 = addDays(t, -25);

    const b1 = mk(r1, {
      description: 'Uses ClaimsPilot to draft the first-notice-of-loss summary for every new claim before routing it.',
      owner: 'Marcus Lee', firstCheckin: f1, weeks: 8,
      outcome: 'Faster intake with no drop in summary quality.', measure: 'Average intake handling time', baseline: 42, target: 30, unit: 'min',
    });
    const b2 = mk(r1, {
      description: 'Reviews the AI-suggested coverage flags before assigning a claim to an adjuster.',
      owner: 'Priya Natarajan', firstCheckin: f1, weeks: 8,
      outcome: 'Fewer claims rerouted after assignment.', measure: 'Claims rerouted after assignment', baseline: 18, target: 8, unit: '%',
    });
    const b3 = mk(r1, {
      description: 'Logs any incorrect AI output in the ClaimsPilot feedback form by Friday each week.',
      owner: 'Sam Ortiz', firstCheckin: f1, weeks: 8,
      outcome: 'Errors are reported so the tool keeps improving.', measure: 'AI errors reported per week', baseline: 0, target: 10, unit: 'reports',
    });
    const b4 = mk(r2, {
      description: 'Saves a MeetingMind call summary to the CRM within 24 hours of every client call.',
      owner: 'Jordan Kim', firstCheckin: f2, weeks: 8,
      outcome: 'Complete, timely CRM notes.', measure: 'Client calls with CRM notes within 24h', baseline: 55, target: 90, unit: '%',
    });
    const b5 = mk(r2, {
      description: 'Reads the AI-generated prep brief before every renewal meeting.',
      owner: 'Taylor Grant', firstCheckin: f2, weeks: 8,
      outcome: 'Better-prepared renewal conversations.', measure: 'Renewal retention rate', baseline: 81, target: 88, unit: '%',
    });

    const ck = (b, pattern, notes = [], measures = [], evidence = []) => {
      pattern.forEach((s, i) => {
        if (!s) return; // null = no check-in recorded that week
        d.checkins.push({
          id: uid(), behaviorId: b.id, weekDate: addDays(b.firstCheckin, i * 7), status: s,
          notes: notes[i] || '', evidence: evidence[i] || '', measureValue: measures[i] ?? '', recordedAt: now,
        });
      });
    };

    ck(b1, ['partly', 'used', 'used', 'used', 'used', 'used'],
      ['Used on about half of new claims while learning the prompts.', 'Used on all new claims.', '', 'Spot-checked 10 summaries, all accurate.', '', 'Now the default way of working.'],
      [41, 38, 36, 34, 33, 32],
      ['', '', '', 'QA spot-check sheet, week 4', '', '']);
    ck(b2, ['used', 'partly', 'used', 'partly', 'not_used', 'not_used'],
      ['', 'Skipped during Tuesday backlog.', '', 'Only checked flags on high-value claims.', 'Flags are on a separate screen. Team stopped opening it.', 'Not used. Same reason as last week.'],
      [17, 17, 15, 15, 16, 17]);
    ck(b3, ['used', 'used', 'partly', 'used', null, null],
      ['Logged 6 errors.', 'Logged 8 errors.', 'Logged 3 errors.', 'Logged 7 errors.'],
      [6, 8, 3, 7]);
    ck(b4, ['partly', 'used', 'partly', 'partly'],
      ['Summaries saved for roughly 60% of calls.', 'All calls covered this week.', 'Some reps unsure how to edit summary before saving.', 'Improving, still uneven across reps.'],
      [61, 72, 68, 74]);
    ck(b5, ['partly', 'not_used', 'not_used', 'not_used'],
      ['Read brief for 2 of 5 renewals.', 'Meetings back to back, no prep window.', 'No prep time again.', 'Not used.'],
      [81, 81, 80, 80]);

    const bar = (b, category, description, ago, status = 'open', resolution = '') => {
      d.barriers.push({
        id: uid(), behaviorId: b.id, rolloutId: b.rolloutId, category, description,
        identifiedDate: addDays(t, -ago), status, resolution,
        resolvedDate: status === 'resolved' ? addDays(t, -ago + 5) : '', createdAt: now,
      });
    };
    bar(b2, 'workflow', 'Coverage flags appear on a separate screen. Adjusters must leave the routing queue to see them.', 10);
    bar(b2, 'willingness', 'Two senior team members say they do not trust the flags after an early false positive.', 4);
    bar(b3, 'time', 'Feedback form takes about 10 minutes and gets dropped during month-end backlog.', 3);
    bar(b4, 'skills', 'Some reps are unsure how to edit the AI summary before saving it to the CRM.', 12);
    bar(b5, 'time', 'Renewal meetings are booked back to back with no prep window.', 17);
    bar(b5, 'access', 'Two reps did not have MeetingMind licenses at launch.', 24, 'resolved', 'IT assigned the missing licenses.');

    d.reviews.push({
      id: uid(), rolloutId: r1.id, date: addDays(t, -11), reviewer: 'Dana Whitfield', assessment: 'at_risk',
      nextReviewDate: addDays(t, 3),
      notes: 'Drafting is sticking. Coverage-flag review slipped this week. Asked Priya to note what gets in the way.',
      outcomeNotes: 'Handling time is down 8 minutes from baseline. Reroute rate has not moved yet.',
      flagged: [], gaps: [], barriersResolved: [],
      snapshot: { behaviors: 3, flagged: 0, gaps: 0, openBarriers: 1 }, createdAt: now,
    });

    d.imports.push(
      {
        id: uid(), opportunity_id: 'PIQ-1042', process_name: 'Subrogation referral',
        opportunity_description: 'AI pre-screens closed claims for subrogation potential.',
        proposed_behavior: 'Reviews the AI subrogation score on every closed claim above $5,000.',
        suggested_owner: 'Alex Romero', expected_outcome: 'More recoveries identified.',
        outcome_measure: 'Subrogation referrals per month', baseline: '12', target: '20', unit: 'referrals',
        status: 'pending', importedAt: now,
      },
      {
        id: uid(), opportunity_id: 'PIQ-1057', process_name: 'Customer complaint triage',
        opportunity_description: 'AI drafts a category and a first reply for each complaint.',
        proposed_behavior: 'Uses the AI draft as the starting point for every first reply to a complaint.',
        suggested_owner: 'Morgan Chen', expected_outcome: 'Faster first response.',
        outcome_measure: 'Hours to first response', baseline: '30', target: '8', unit: 'hours',
        status: 'pending', importedAt: now,
      },
    );
    return d;
  }

  /* ------------------------------------------------------------------------
     5. Lookups and the adoption rules
     ------------------------------------------------------------------------ */
  const rolloutById = (id) => db.rollouts.find((r) => r.id === id);
  const behaviorById = (id) => db.behaviors.find((b) => b.id === id);
  const findCheckin = (bid, date) => db.checkins.find((c) => c.behaviorId === bid && c.weekDate === date);

  function scheduleFor(b) {
    const out = [];
    for (let i = 0; i < b.weeks; i++) out.push(addDays(b.firstCheckin, i * 7));
    return out;
  }

  function streakFromEnd(arr, test) {
    let n = 0;
    for (let i = arr.length - 1; i >= 0 && test(arr[i]); i--) n++;
    return n;
  }

  function outcomeProgress(base, target, cur) {
    if (!isNum(base) || !isNum(target) || cur === null || cur === undefined) return null;
    const B = Number(base);
    const T = Number(target);
    if (T === B) return cur === T ? 100 : 0;
    return Math.round(((cur - B) / (T - B)) * 100);
  }

  /**
   * The core rules. A reporting week is "completed" when a check-in has been
   * recorded for it, or when its date has passed without one ("missing").
   * Missing weeks are kept separate from weeks reported as "Not used".
   */
  function analyze(b) {
    const today = todayISO();
    const mine = new Map(db.checkins.filter((c) => c.behaviorId === b.id).map((c) => [c.weekDate, c]));
    const weeks = scheduleFor(b).map((date) => {
      const c = mine.get(date);
      let state;
      if (c) state = c.status;
      else if (date < today) state = 'missing';
      else if (date === today) state = 'due';
      else state = 'upcoming';
      return { date, state, checkin: c || null };
    });
    const completed = weeks.filter((w) => w.state !== 'due' && w.state !== 'upcoming');
    const reported = completed.filter((w) => w.checkin);
    const last = completed[completed.length - 1] || null;

    const missedStreak = streakFromEnd(completed, (w) => w.state === 'not_used');
    const missingStreak = streakFromEnd(completed, (w) => w.state === 'missing');
    const usedStreak = streakFromEnd(completed, (w) => w.state === 'used');
    const reportedMissedStreak = streakFromEnd(reported, (w) => w.state === 'not_used');
    const missingWeeks = completed.filter((w) => w.state === 'missing');
    const counts = { used: 0, partly: 0, not_used: 0 };
    reported.forEach((w) => { counts[w.state] += 1; });
    const adoptionRate = reported.length
      ? Math.round(((counts.used + counts.partly * 0.5) / reported.length) * 100) : null;

    let status;
    if (b.paused) status = 'paused';
    else if (!last) status = 'not_started';
    else if (missedStreak >= FLAG_WEEKS) status = 'flagged';
    else if (last.state === 'missing') status = 'gap';
    else if (usedStreak >= SUSTAINED_WEEKS) status = 'sustained';
    else if (last.state === 'used') status = 'on_track';
    else status = 'watch';

    const measured = reported.filter((w) => isNum(w.checkin.measureValue));
    let current = null;
    if (measured.length) current = Number(measured[measured.length - 1].checkin.measureValue);
    else if (isNum(b.current)) current = Number(b.current);

    const openBarriers = db.barriers.filter((x) => x.behaviorId === b.id && x.status === 'open');
    const nextAction = [...weeks].reverse().find((w) => w.state === 'missing' || w.state === 'due');

    return {
      weeks, completed, reported, last, status, counts, adoptionRate,
      missedStreak, missingStreak, usedStreak, reportedMissedStreak,
      missingTotal: missingWeeks.length, missingWeeks,
      current, progress: outcomeProgress(b.baseline, b.target, current),
      openBarriers,
      suggestedDate: nextAction ? nextAction.date : (last ? last.date : null),
    };
  }

  function statusReason(a) {
    switch (a.status) {
      case 'flagged':
        return `Reported "Not used" for ${a.missedStreak} completed weeks in a row.`;
      case 'gap': {
        let s = `No check-in recorded for the last ${plural(a.missingStreak, 'completed week')}.`;
        if (a.reportedMissedStreak >= FLAG_WEEKS) s += ` The last ${a.reportedMissedStreak} reported weeks were "Not used".`;
        return s;
      }
      case 'watch':
        return a.last.state === 'partly'
          ? 'Most recent week was "Partly used".'
          : 'Most recent week was "Not used". One more will raise a flag.';
      case 'sustained':
        return `"Used" for ${a.usedStreak} weeks in a row.`;
      case 'on_track':
        return 'Most recent week was "Used".';
      case 'not_started':
        return a.weeks.length ? `First check-in is ${fmtDate(a.weeks[0].date)}.` : 'No check-in dates set.';
      case 'paused':
        return 'Paused or retired. Not counted in dashboard totals.';
      default:
        return '';
    }
  }

  function behaviorRows(rolloutId) {
    return db.behaviors
      .filter((b) => (rolloutId === 'all' || b.rolloutId === rolloutId) && rolloutById(b.rolloutId))
      .map((b) => ({ b, r: rolloutById(b.rolloutId), a: analyze(b) }))
      .sort((x, y) => BEHAVIOR_STATUS[x.a.status].rank - BEHAVIOR_STATUS[y.a.status].rank
        || y.a.missedStreak - x.a.missedStreak
        || y.a.missingTotal - x.a.missingTotal);
  }

  function rolloutStats(rolloutId) {
    const rows = behaviorRows(rolloutId);
    const active = rows.filter((x) => x.a.status !== 'paused');
    return {
      rows, active,
      flagged: active.filter((x) => x.a.status === 'flagged'),
      gaps: active.filter((x) => x.a.missingTotal > 0),
      missingWeeks: sum(active, (x) => x.a.missingTotal),
      adopting: active.filter((x) => x.a.status === 'on_track' || x.a.status === 'sustained'),
      openBarriers: db.barriers.filter((x) => x.status === 'open' && (rolloutId === 'all' || x.rolloutId === rolloutId)
        && behaviorById(x.behaviorId) && !behaviorById(x.behaviorId).paused),
    };
  }

  const latestReview = (rolloutId) => db.reviews
    .filter((r) => r.rolloutId === rolloutId)
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))[0];

  /* ------------------------------------------------------------------------
     6. Shared building blocks for pages
     ------------------------------------------------------------------------ */
  const ui = {
    rolloutFilter: 'all',
    barrierFilter: 'open',
    barrierCategory: 'all',
    importPreview: null,
    reviewDraft: null,
    lastRoute: '',
  };

  function pageHead(title, lead, actions = '') {
    return `<div class="page-head">
      <div><h1>${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </div>`;
  }

  const badge = (status) => {
    const s = BEHAVIOR_STATUS[status];
    return `<span class="badge tone-${s.tone}">${esc(s.label)}</span>`;
  };
  const assessmentBadge = (id) => {
    const s = ASSESSMENTS[id];
    return s ? `<span class="badge tone-${s.tone}">${esc(s.label)}</span>` : '';
  };
  const barrierChip = (cat) => `<span class="chip cat-${esc(cat)}">${esc(barrierLabel(cat))}</span>`;

  function rolloutFilterSelect() {
    if (db.rollouts.length < 2) return '';
    return `<label class="inline-field"><span>Show</span>
      <select data-change="filter-rollout">
        <option value="all">All rollouts</option>
        ${db.rollouts.map((r) => `<option value="${esc(r.id)}" ${ui.rolloutFilter === r.id ? 'selected' : ''}>${esc(r.tool)}</option>`).join('')}
      </select></label>`;
  }

  function weekStrip(b, a, { labels = false, max = 12 } = {}) {
    let weeks = a.weeks;
    if (weeks.length > max) {
      const firstFuture = weeks.findIndex((w) => w.state === 'upcoming');
      const end = firstFuture === -1 ? weeks.length : Math.min(weeks.length, firstFuture + 2);
      weeks = weeks.slice(Math.max(0, end - max), end);
    }
    return `<div class="weeks ${labels ? 'with-labels' : ''}" role="list" aria-label="Weekly check-ins">
      ${weeks.map((w) => {
        const st = WEEK_STATE[w.state];
        const text = `Week of ${fmtDate(w.date)}: ${st.label}`;
        const disabled = w.state === 'upcoming';
        return `<button type="button" role="listitem" class="wk wk-${w.state}" ${disabled ? 'disabled' : ''}
            data-action="checkin" data-b="${esc(b.id)}" data-d="${w.date}" title="${esc(text)}${disabled ? '' : '. Click to record or edit.'}" aria-label="${esc(text)}">
            <span class="wk-dot" aria-hidden="true">${st.icon}</span>
            ${labels ? `<span class="wk-date">${esc(fmtShort(w.date))}</span>` : ''}
          </button>`;
      }).join('')}
    </div>`;
  }

  function weekLegend() {
    return `<div class="legend" aria-label="Legend">
      ${['used', 'partly', 'not_used', 'missing', 'upcoming'].map((s) => `<span><i class="wk-dot mini wk-${s}">${WEEK_STATE[s].icon}</i>${esc(s === 'missing' ? 'No check-in' : WEEK_STATE[s].label)}</span>`).join('')}
    </div>`;
  }

  function progressBar(p) {
    if (p === null) return '<span class="muted small">No current value yet</span>';
    const w = Math.max(0, Math.min(100, p));
    const tone = p >= 100 ? 'good' : p >= 50 ? 'mid' : p > 0 ? 'low' : 'none';
    const label = p < 0 ? `Moving away from target (${p}%)` : `${p}% of the way to target`;
    return `<div class="progress" title="${esc(label)}">
      <div class="progress-track"><div class="progress-fill p-${tone}" style="width:${w}%"></div></div>
      <span class="progress-label">${esc(label)}</span>
    </div>`;
  }

  function outcomeLine(b, a) {
    if (!b.measure && !isNum(b.baseline) && !isNum(b.target)) return '<p class="muted small">No measure defined yet.</p>';
    return `<div class="outcome">
      <div class="outcome-head"><strong>${esc(b.measure || 'Outcome measure')}</strong>${b.outcome ? `<span class="muted"> · ${esc(b.outcome)}</span>` : ''}</div>
      <div class="outcome-nums">
        <span><small>Baseline</small>${esc(fmtVal(b.baseline, b.unit))}</span>
        <span><small>Current</small>${esc(a.current === null ? '-' : fmtVal(a.current, b.unit))}</span>
        <span><small>Target</small>${esc(fmtVal(b.target, b.unit))}</span>
      </div>
      ${progressBar(a.progress)}
    </div>`;
  }

  function emptyState(title, text, actions = '') {
    return `<div class="empty"><h2>${esc(title)}</h2><p>${text}</p>${actions ? `<div class="actions center">${actions}</div>` : ''}</div>`;
  }

  function banners() {
    let html = '';
    if (!storageOK) {
      html += `<div class="banner tone-bad"><strong>Saving is blocked in this browser.</strong> Changes will be lost when you close the page. Try a normal (not private) window, or download a backup from the Data page.</div>`;
    }
    if (db.meta.sample) {
      html += `<div class="banner tone-info">
        <div><strong>You are viewing fictional example data.</strong> Explore freely. Nothing here is real. When you are ready, start with a blank tracker.</div>
        <div class="actions"><button class="btn small" data-action="start-fresh">Start with a blank tracker</button></div>
      </div>`;
    } else if (db.rollouts.length) {
      const last = db.meta.lastBackupAt;
      const age = last ? daysBetween(last.slice(0, 10), todayISO()) : null;
      if (age === null || age >= BACKUP_REMINDER_DAYS) {
        html += `<div class="banner tone-warn">
          <div><strong>${age === null ? 'You have not downloaded a backup yet.' : `Your last backup was ${age} days ago.`}</strong> Your data lives only in this browser. A backup file protects it.</div>
          <div class="actions"><button class="btn small" data-action="backup">Download backup</button></div>
        </div>`;
      }
    }
    return html;
  }

  /* ------------------------------------------------------------------------
     7. Pages
     ------------------------------------------------------------------------ */

  /* ---- Dashboard ---- */
  function viewDashboard() {
    if (!db.rollouts.length) {
      return banners() + pageHead('Adoption dashboard') + emptyState(
        'No rollouts yet',
        'Start by creating a rollout: the AI tool, the team using it, the sponsor, and the launch date. Then define the behaviors you expect to see.',
        `<button class="btn primary" data-action="new-rollout">Create a rollout</button>
         <button class="btn" data-action="load-sample">Load example data</button>`,
      );
    }
    const st = rolloutStats(ui.rolloutFilter);
    const attention = st.active.filter((x) => x.a.status === 'flagged' || x.a.status === 'gap');
    const withMeasure = st.rows.filter((x) => x.b.measure || isNum(x.b.baseline));

    const kpi = (n, label, sub, tone = '') => `<div class="kpi ${tone ? `tone-${tone}` : ''}"><div class="kpi-num">${n}</div><div class="kpi-label">${label}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;

    const barrierCounts = BARRIER_TYPES.map((t) => ({ ...t, n: st.openBarriers.filter((x) => x.category === t.id).length }));
    const maxBar = Math.max(1, ...barrierCounts.map((x) => x.n));

    return `${banners()}
    ${pageHead('Adoption dashboard', `As of ${esc(fmtDate(todayISO()))}. Are the expected behaviors happening, sticking, and paying off?`,
      `${rolloutFilterSelect()}<a class="btn" href="#summary-${ui.rolloutFilter === 'all' ? 'all' : esc(ui.rolloutFilter)}">Summary</a>`)}

    <section class="kpis" aria-label="Key numbers">
      ${kpi(st.active.length, 'Behaviors tracked', `${plural(ui.rolloutFilter === 'all' ? db.rollouts.length : 1, 'rollout')}`)}
      ${kpi(st.adopting.length, 'On track or sustained', st.active.length ? `${Math.round((st.adopting.length / st.active.length) * 100)}% of behaviors` : '', 'good')}
      ${kpi(st.flagged.length, 'Missed 2+ weeks in a row', 'Reported "Not used"', st.flagged.length ? 'bad' : '')}
      ${kpi(st.missingWeeks, 'Missing check-ins', st.gaps.length ? `Across ${plural(st.gaps.length, 'behavior')}` : 'None outstanding', st.missingWeeks ? 'gap' : '')}
      ${kpi(st.openBarriers.length, 'Unresolved barriers', '', st.openBarriers.length ? 'warn' : '')}
    </section>

    ${attention.length ? `<section class="card">
      <h2>Needs attention</h2>
      <ul class="attention">
        ${attention.map(({ b, r, a }) => `<li>
          <div class="attention-main">
            ${badge(a.status)}
            <a class="strong" href="#rollout-${esc(r.id)}">${esc(b.description)}</a>
            <div class="sub">${esc(b.owner)} · ${esc(r.tool)}</div>
            <div class="sub">${esc(statusReason(a))}${a.openBarriers.length ? ` ${plural(a.openBarriers.length, 'open barrier')}.` : ' No barrier logged yet.'}</div>
          </div>
          <div class="actions">
            ${a.suggestedDate ? `<button class="btn small" data-action="checkin" data-b="${esc(b.id)}" data-d="${a.suggestedDate}">Record check-in</button>` : ''}
            <button class="btn small" data-action="new-barrier" data-b="${esc(b.id)}">Log barrier</button>
          </div>
        </li>`).join('')}
      </ul>
    </section>` : ''}

    <section class="card">
      <div class="card-head"><h2>Behavior status</h2>${weekLegend()}</div>
      ${st.rows.length ? `<div class="table-wrap"><table class="table responsive">
        <thead><tr><th>Behavior</th><th>Status</th><th>Weekly record</th><th class="num">Missed in a row</th><th class="num">Missing check-ins</th><th class="num">Open barriers</th></tr></thead>
        <tbody>
        ${st.rows.map(({ b, r, a }) => `<tr class="${a.status === 'paused' ? 'is-paused' : ''}">
          <td data-label="Behavior"><a class="strong" href="#rollout-${esc(r.id)}">${esc(b.description)}</a><div class="sub">${esc(b.owner)} · ${esc(r.tool)}</div></td>
          <td data-label="Status">${badge(a.status)}<div class="sub">${esc(statusReason(a))}</div></td>
          <td data-label="Weekly record">${weekStrip(b, a, { max: 8 })}</td>
          <td data-label="Missed in a row" class="num"><span class="${a.missedStreak >= FLAG_WEEKS ? 'num-bad' : ''}">${a.missedStreak}</span></td>
          <td data-label="Missing check-ins" class="num"><span class="${a.missingTotal ? 'num-gap' : ''}">${a.missingTotal}</span></td>
          <td data-label="Open barriers" class="num">${a.openBarriers.length}</td>
        </tr>`).join('')}
        </tbody></table></div>` : '<p class="muted">No behaviors defined yet. Open a rollout to add one.</p>'}
    </section>

    <div class="grid-2">
      <section class="card">
        <h2>Outcomes: baseline vs target</h2>
        ${withMeasure.length ? `<div class="table-wrap"><table class="table responsive">
          <thead><tr><th>Measure</th><th class="num">Baseline</th><th class="num">Current</th><th class="num">Target</th><th>Progress</th></tr></thead>
          <tbody>${withMeasure.map(({ b, a }) => `<tr>
            <td data-label="Measure"><span class="strong">${esc(b.measure || 'Outcome')}</span><div class="sub">${esc(b.owner)}</div></td>
            <td data-label="Baseline" class="num">${esc(fmtVal(b.baseline, b.unit))}</td>
            <td data-label="Current" class="num">${esc(a.current === null ? '-' : fmtVal(a.current, b.unit))}</td>
            <td data-label="Target" class="num">${esc(fmtVal(b.target, b.unit))}</td>
            <td data-label="Progress">${progressBar(a.progress)}</td>
          </tr>`).join('')}</tbody></table></div>` : '<p class="muted">Add a measure, baseline, and target to a behavior to see progress here.</p>'}
      </section>

      <section class="card">
        <div class="card-head"><h2>Unresolved barriers by type</h2><a class="link small" href="#barriers">View all</a></div>
        ${st.openBarriers.length ? `<ul class="bars">
          ${barrierCounts.map((x) => `<li><span class="bars-label">${esc(x.label)}</span>
            <span class="bars-track"><span class="bars-fill cat-${x.id}" style="width:${(x.n / maxBar) * 100}%"></span></span>
            <span class="bars-n">${x.n}</span></li>`).join('')}
        </ul>` : '<p class="muted">No unresolved barriers.</p>'}
      </section>
    </div>`;
  }

  /* ---- Rollouts list ---- */
  function viewRollouts() {
    const head = pageHead('Rollouts', 'Each rollout is one AI tool introduced to one team.', '<button class="btn primary" data-action="new-rollout">New rollout</button>');
    if (!db.rollouts.length) {
      return head + emptyState('No rollouts yet', 'Create your first rollout to start tracking adoption.', '<button class="btn primary" data-action="new-rollout">Create a rollout</button>');
    }
    const sorted = [...db.rollouts].sort((a, b) => String(b.launchDate).localeCompare(String(a.launchDate)));
    return `${head}<div class="cards">
      ${sorted.map((r) => {
        const st = rolloutStats(r.id);
        const rev = latestReview(r.id);
        return `<a class="card rollout-card" href="#rollout-${esc(r.id)}">
          <h2>${esc(r.tool)}</h2>
          <dl class="facts">
            <div><dt>Team</dt><dd>${esc(r.team)}</dd></div>
            <div><dt>Sponsor</dt><dd>${esc(r.sponsor)}</dd></div>
            <div><dt>Launched</dt><dd>${esc(fmtDate(r.launchDate))}</dd></div>
            <div><dt>Last review</dt><dd>${rev ? `${esc(fmtDate(rev.date))} ${assessmentBadge(rev.assessment)}` : 'None yet'}</dd></div>
          </dl>
          <div class="mini-stats">
            <span>${plural(st.active.length, 'behavior')}</span>
            <span class="${st.flagged.length ? 'num-bad' : ''}">${st.flagged.length} missed 2+ wks</span>
            <span class="${st.missingWeeks ? 'num-gap' : ''}">${plural(st.missingWeeks, 'missing check-in')}</span>
            <span>${plural(st.openBarriers.length, 'open barrier')}</span>
          </div>
        </a>`;
      }).join('')}
    </div>`;
  }

  /* ---- Rollout detail ---- */
  function viewRollout(id) {
    const r = rolloutById(id);
    if (!r) return emptyState('Rollout not found', 'It may have been deleted.', '<a class="btn" href="#rollouts">Back to rollouts</a>');
    const st = rolloutStats(r.id);
    const barriers = db.barriers.filter((x) => x.rolloutId === r.id).sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1));
    const reviews = db.reviews.filter((x) => x.rolloutId === r.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));

    return `<a class="back" href="#rollouts">← All rollouts</a>
    ${pageHead(r.tool, `${esc(r.team)} · Sponsor: ${esc(r.sponsor)} · Launched ${esc(fmtDate(r.launchDate))}`,
      `<button class="btn primary" data-action="new-behavior" data-r="${esc(r.id)}">Add behavior</button>
       <a class="btn" href="#review-${esc(r.id)}">Manager review</a>
       <a class="btn" href="#summary-${esc(r.id)}">Summary</a>
       <button class="btn" data-action="edit-rollout" data-r="${esc(r.id)}">Edit</button>`)}
    ${r.purpose ? `<p class="purpose">${esc(r.purpose)}</p>` : ''}

    <div class="mini-stats big">
      <span>${plural(st.active.length, 'active behavior')}</span>
      <span class="${st.flagged.length ? 'num-bad' : ''}">${st.flagged.length} missed 2+ weeks</span>
      <span class="${st.missingWeeks ? 'num-gap' : ''}">${plural(st.missingWeeks, 'missing check-in')}</span>
      <span>${plural(st.openBarriers.length, 'unresolved barrier')}</span>
    </div>

    <section>
      <div class="section-head"><h2>Expected behaviors</h2>${weekLegend()}</div>
      ${st.rows.length ? st.rows.map(({ b, a }) => behaviorCard(b, a)).join('')
        : emptyState('No behaviors yet', 'Describe what people should visibly do differently with the tool. For example: "Uses the AI draft as the starting point for every customer reply."', `<button class="btn primary" data-action="new-behavior" data-r="${esc(r.id)}">Add behavior</button>`)}
    </section>

    <section class="card">
      <div class="card-head"><h2>Barriers</h2>${st.rows.length ? `<button class="btn small" data-action="new-barrier" data-r="${esc(r.id)}">Log barrier</button>` : ''}</div>
      ${barriers.length ? `<ul class="list">${barriers.map(barrierItem).join('')}</ul>` : '<p class="muted">No barriers logged for this rollout.</p>'}
    </section>

    <section class="card">
      <div class="card-head"><h2>Manager reviews</h2><a class="btn small" href="#review-${esc(r.id)}">Start review</a></div>
      ${reviews.length ? `<ul class="list">${reviews.map(reviewItem).join('')}</ul>` : '<p class="muted">No reviews yet. A review walks you through flagged behaviors, missing check-ins, barriers, and outcomes.</p>'}
    </section>

    <div class="danger-zone"><button class="btn danger small" data-action="delete-rollout" data-r="${esc(r.id)}">Delete this rollout</button></div>`;
  }

  function behaviorCard(b, a) {
    return `<article class="card behavior ${b.paused ? 'is-paused' : ''}" id="b-${esc(b.id)}">
      <div class="behavior-head">
        <h3>${esc(b.description)}</h3>
        ${badge(a.status)}
      </div>
      <p class="sub">Owner: <strong>${esc(b.owner)}</strong> · Weekly check-ins from ${esc(fmtDate(b.firstCheckin))} (${plural(b.weeks, 'week')})${b.source === 'processiq' ? ` · From ProcessIQ ${esc(b.sourceId)}` : ''}</p>
      <p class="reason">${esc(statusReason(a))}</p>
      ${weekStrip(b, a, { labels: true, max: 16 })}
      <div class="mini-stats">
        <span class="${a.missedStreak >= FLAG_WEEKS ? 'num-bad' : ''}">Missed in a row: ${a.missedStreak}</span>
        <span class="${a.missingTotal ? 'num-gap' : ''}">Missing check-ins: ${a.missingTotal}</span>
        <span>Reported weeks: ${a.reported.length}</span>
        <span>Adoption: ${a.adoptionRate === null ? '-' : `${a.adoptionRate}%`}</span>
      </div>
      ${outcomeLine(b, a)}
      ${a.openBarriers.length ? `<div class="barrier-chips"><span class="small muted">Open barriers:</span> ${a.openBarriers.map((x) => `<span class="barrier-line">${barrierChip(x.category)} <span class="small">${esc(x.description)}</span></span>`).join('')}</div>` : ''}
      <div class="actions">
        ${a.suggestedDate ? `<button class="btn small primary" data-action="checkin" data-b="${esc(b.id)}" data-d="${a.suggestedDate}">Record check-in</button>` : ''}
        <button class="btn small" data-action="new-barrier" data-b="${esc(b.id)}">Log barrier</button>
        <button class="btn small" data-action="edit-behavior" data-b="${esc(b.id)}">Edit</button>
        <button class="btn small ghost danger-text" data-action="delete-behavior" data-b="${esc(b.id)}">Delete</button>
      </div>
    </article>`;
  }

  function barrierItem(x) {
    const b = behaviorById(x.behaviorId);
    const r = rolloutById(x.rolloutId);
    return `<li class="list-item ${x.status === 'resolved' ? 'is-resolved' : ''}">
      <div class="list-main">
        <div>${barrierChip(x.category)} <span class="badge ${x.status === 'open' ? 'tone-warn' : 'tone-good'}">${x.status === 'open' ? 'Unresolved' : 'Resolved'}</span></div>
        <p>${esc(x.description || 'No description')}</p>
        <div class="sub">${b ? esc(b.description) : 'Behavior deleted'}${r ? ` · ${esc(r.tool)}` : ''}${b ? ` · ${esc(b.owner)}` : ''}</div>
        <div class="sub">Identified ${esc(fmtDate(x.identifiedDate))}${x.status === 'resolved' ? ` · Resolved ${esc(fmtDate(x.resolvedDate))}` : ''}</div>
        ${x.resolution ? `<div class="sub"><strong>Resolution:</strong> ${esc(x.resolution)}</div>` : ''}
      </div>
      <div class="actions">
        ${x.status === 'open' ? `<button class="btn small" data-action="resolve-barrier" data-id="${esc(x.id)}">Mark resolved</button>` : `<button class="btn small" data-action="reopen-barrier" data-id="${esc(x.id)}">Reopen</button>`}
        <button class="btn small" data-action="edit-barrier" data-id="${esc(x.id)}">Edit</button>
        <button class="btn small ghost danger-text" data-action="delete-barrier" data-id="${esc(x.id)}">Delete</button>
      </div>
    </li>`;
  }

  function reviewItem(rv) {
    const decided = (rv.flagged || []).length + (rv.gaps || []).length;
    return `<li class="list-item">
      <div class="list-main">
        <div><strong>${esc(fmtDate(rv.date))}</strong> ${assessmentBadge(rv.assessment)} <span class="sub">by ${esc(rv.reviewer || 'Unknown')}</span></div>
        ${rv.notes ? `<p>${esc(rv.notes)}</p>` : ''}
        <div class="sub">${plural(decided, 'decision')} recorded · ${plural((rv.barriersResolved || []).length, 'barrier')} resolved${rv.nextReviewDate ? ` · Next review ${esc(fmtDate(rv.nextReviewDate))}` : ''}</div>
      </div>
      <div class="actions"><button class="btn small" data-action="view-review" data-id="${esc(rv.id)}">View</button>
      <button class="btn small ghost danger-text" data-action="delete-review" data-id="${esc(rv.id)}">Delete</button></div>
    </li>`;
  }

  /* ---- Check-ins ---- */
  function viewCheckins() {
    if (!db.behaviors.length) {
      return pageHead('Weekly check-ins') + emptyState('Nothing to check in yet', 'Add a behavior to a rollout first. Its weekly check-in dates will show up here.', '<a class="btn primary" href="#rollouts">Go to rollouts</a>');
    }
    const today = todayISO();
    const horizon = addDays(today, 7);
    const rows = behaviorRows(ui.rolloutFilter).filter((x) => x.a.status !== 'paused');
    const overdue = [];
    const upcoming = [];
    rows.forEach(({ b, r, a }) => {
      a.weeks.forEach((w) => {
        if (w.state === 'missing') overdue.push({ b, r, w });
        else if ((w.state === 'due' || w.state === 'upcoming') && w.date <= horizon) upcoming.push({ b, r, w });
      });
    });
    overdue.sort((x, y) => y.w.date.localeCompare(x.w.date));
    upcoming.sort((x, y) => x.w.date.localeCompare(y.w.date));
    const recent = db.checkins
      .filter((c) => { const b = behaviorById(c.behaviorId); return b && rolloutById(b.rolloutId) && (ui.rolloutFilter === 'all' || b.rolloutId === ui.rolloutFilter); })
      .sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)) || b.weekDate.localeCompare(a.weekDate))
      .slice(0, 12);

    const item = ({ b, r, w }) => `<li class="list-item">
      <div class="list-main">
        <div><strong>${esc(fmtDate(w.date))}</strong> <span class="badge tone-${w.state === 'missing' ? 'gap' : 'neutral'}">${w.state === 'missing' ? 'No check-in yet' : w.state === 'due' ? 'Due today' : 'Coming up'}</span></div>
        <p>${esc(b.description)}</p>
        <div class="sub">${esc(b.owner)} · ${esc(r.tool)}</div>
      </div>
      <div class="actions">${w.state === 'upcoming' ? '<span class="small muted">Opens on the check-in date</span>' : `<button class="btn small primary" data-action="checkin" data-b="${esc(b.id)}" data-d="${w.date}">Record</button>`}</div>
    </li>`;

    return `${pageHead('Weekly check-ins', 'Record whether each behavior was Used, Partly used, or Not used for the week. A week with no check-in is tracked separately as missing.', rolloutFilterSelect())}
    <section class="card">
      <h2>Missing check-ins <span class="count">${overdue.length}</span></h2>
      <p class="muted small">These check-in dates have passed with nothing recorded. They are not counted as "Not used".</p>
      ${overdue.length ? `<ul class="list">${overdue.map(item).join('')}</ul>` : '<p class="muted">All caught up.</p>'}
    </section>
    <section class="card">
      <h2>Due in the next 7 days <span class="count">${upcoming.length}</span></h2>
      ${upcoming.length ? `<ul class="list">${upcoming.map(item).join('')}</ul>` : '<p class="muted">Nothing due this week.</p>'}
    </section>
    <section class="card">
      <h2>Recently recorded</h2>
      ${recent.length ? `<ul class="list">${recent.map((c) => {
        const b = behaviorById(c.behaviorId);
        return `<li class="list-item">
          <div class="list-main">
            <div><i class="wk-dot mini wk-${c.status}">${CHECKIN_STATUS[c.status].icon}</i> <strong>${esc(CHECKIN_STATUS[c.status].label)}</strong> <span class="sub">week of ${esc(fmtDate(c.weekDate))}</span></div>
            <p>${esc(b.description)}</p>
            ${c.notes ? `<div class="sub">${esc(c.notes)}</div>` : ''}
            ${c.evidence ? `<div class="sub">Evidence: ${evidenceHtml(c.evidence)}</div>` : ''}
          </div>
          <div class="actions"><button class="btn small" data-action="checkin" data-b="${esc(b.id)}" data-d="${c.weekDate}">Edit</button></div>
        </li>`;
      }).join('')}</ul>` : '<p class="muted">No check-ins recorded yet.</p>'}
    </section>`;
  }

  /* ---- Barriers ---- */
  function viewBarriers() {
    const list = db.barriers
      .filter((x) => rolloutById(x.rolloutId) && behaviorById(x.behaviorId))
      .filter((x) => ui.barrierFilter === 'all' || x.status === ui.barrierFilter)
      .filter((x) => ui.barrierCategory === 'all' || x.category === ui.barrierCategory)
      .filter((x) => ui.rolloutFilter === 'all' || x.rolloutId === ui.rolloutFilter)
      .sort((a, b) => String(b.identifiedDate).localeCompare(String(a.identifiedDate)));
    const seg = (val, label) => `<button class="seg ${ui.barrierFilter === val ? 'on' : ''}" data-action="barrier-filter" data-v="${val}" aria-pressed="${ui.barrierFilter === val}">${label}</button>`;
    return `${pageHead('Barriers', 'Possible reasons a behavior is not happening. Log what you hear, then resolve it.',
      db.behaviors.length ? '<button class="btn primary" data-action="new-barrier">Log barrier</button>' : '')}
    <div class="toolbar">
      <div class="segmented" role="group" aria-label="Status">${seg('open', 'Unresolved')}${seg('resolved', 'Resolved')}${seg('all', 'All')}</div>
      <label class="inline-field"><span>Type</span><select data-change="barrier-category">
        <option value="all">All types</option>
        ${BARRIER_TYPES.map((t) => `<option value="${t.id}" ${ui.barrierCategory === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
      </select></label>
      ${rolloutFilterSelect()}
    </div>
    <details class="card hint-card"><summary>What do the barrier types mean?</summary>
      <dl class="defs">${BARRIER_TYPES.map((t) => `<div><dt>${barrierChip(t.id)}</dt><dd>${esc(t.hint)}</dd></div>`).join('')}</dl>
    </details>
    <section class="card">
      ${list.length ? `<ul class="list">${list.map(barrierItem).join('')}</ul>` : `<p class="muted">No barriers match these filters.</p>`}
    </section>`;
  }

  /* ---- Manager review workflow ---- */
  const REVIEW_STEPS = ['Missed 2+ weeks', 'Missing check-ins', 'Barriers', 'Outcomes', 'Sign off'];

  function viewReview(id) {
    if (!id) {
      const head = pageHead('Manager review', 'A guided, five-step review for one rollout. Use it in your regular adoption check-in meeting.');
      if (!db.rollouts.length) return head + emptyState('No rollouts to review', 'Create a rollout first.', '<button class="btn primary" data-action="new-rollout">Create a rollout</button>');
      return `${head}<ol class="steps-preview">${REVIEW_STEPS.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="cards">${db.rollouts.map((r) => {
        const st = rolloutStats(r.id);
        const rev = latestReview(r.id);
        const overdue = rev && rev.nextReviewDate && rev.nextReviewDate < todayISO();
        return `<div class="card">
          <h2>${esc(r.tool)}</h2>
          <p class="sub">${esc(r.team)}</p>
          <div class="mini-stats">
            <span class="${st.flagged.length ? 'num-bad' : ''}">${st.flagged.length} missed 2+ wks</span>
            <span class="${st.missingWeeks ? 'num-gap' : ''}">${plural(st.missingWeeks, 'missing check-in')}</span>
            <span>${plural(st.openBarriers.length, 'open barrier')}</span>
          </div>
          <p class="sub">Last review: ${rev ? `${esc(fmtDate(rev.date))} ${assessmentBadge(rev.assessment)}` : 'none yet'}${rev && rev.nextReviewDate ? ` · Next: <span class="${overdue ? 'num-bad' : ''}">${esc(fmtDate(rev.nextReviewDate))}${overdue ? ' (overdue)' : ''}</span>` : ''}</p>
          <div class="actions"><a class="btn primary" href="#review-${esc(r.id)}">Start review</a></div>
        </div>`;
      }).join('')}</div>`;
    }

    const r = rolloutById(id);
    if (!r) return emptyState('Rollout not found', '', '<a class="btn" href="#review">Back</a>');
    if (!ui.reviewDraft || ui.reviewDraft.rolloutId !== id) {
      ui.reviewDraft = {
        rolloutId: id, step: 0, flags: {}, gaps: {}, barriers: {}, outcomeNotes: '',
        reviewer: (latestReview(id) || {}).reviewer || '', date: todayISO(),
        assessment: '', nextReviewDate: addDays(todayISO(), 14), notes: '',
      };
    }
    const dr = ui.reviewDraft;
    const st = rolloutStats(id);
    const step = dr.step;

    const stepper = `<ol class="stepper" aria-label="Review steps">${REVIEW_STEPS.map((s, i) => `<li class="${i === step ? 'current' : i < step ? 'done' : ''}">
      <button type="button" data-action="review-step" data-step="${i}" ${i === step ? 'aria-current="step"' : ''}><span class="step-n">${i + 1}</span><span class="step-label">${esc(s)}</span></button></li>`).join('')}</ol>`;

    const decisionSelect = (path, list) => {
      const v = getPath(dr, path) || '';
      return `<label class="field"><span>Decision</span><select data-draft="${esc(path)}">
        <option value="">Choose a decision...</option>
        ${list.map((d) => `<option value="${d.id}" ${v === d.id ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}
      </select></label>`;
    };
    const noteField = (path, label = 'Notes and next action', ph = 'Who will do what, by when?') => `<label class="field"><span>${esc(label)}</span>
      <textarea rows="2" data-draft="${esc(path)}" placeholder="${esc(ph)}">${esc(getPath(dr, path) || '')}</textarea></label>`;

    let body = '';
    if (step === 0) {
      body = `<h2>Step 1: Behaviors missed 2+ weeks in a row</h2>
      <p class="muted">These were reported "Not used" for at least two completed weeks in a row. Decide what support each one needs.</p>
      ${st.flagged.length ? st.flagged.map(({ b, a }) => `<div class="review-item">
        <div class="behavior-head"><h3>${esc(b.description)}</h3>${badge(a.status)}</div>
        <p class="sub">Owner: ${esc(b.owner)} · ${esc(statusReason(a))}</p>
        ${weekStrip(b, a, { labels: true })}
        ${recentNotes(a)}
        ${a.openBarriers.length ? `<div class="barrier-chips"><span class="small muted">Barriers logged:</span> ${a.openBarriers.map((x) => `<span class="barrier-line">${barrierChip(x.category)} <span class="small">${esc(x.description)}</span></span>`).join('')}</div>`
          : `<p class="small"><span class="badge tone-warn">No barrier logged</span> Consider asking the owner what is getting in the way. <button class="link" data-action="new-barrier" data-b="${esc(b.id)}">Log a barrier</button></p>`}
        <div class="form-grid">${decisionSelect(`flags.${b.id}.decision`, FLAG_DECISIONS)}${noteField(`flags.${b.id}.note`)}</div>
      </div>`).join('') : '<p class="ok-note">No behaviors were missed two weeks in a row. Nothing to decide here.</p>'}`;
    } else if (step === 1) {
      body = `<h2>Step 2: Missing check-ins</h2>
      <p class="muted">No one reported on these weeks. Missing data is not the same as nonuse, so decide how to close the gap.</p>
      ${st.gaps.length ? st.gaps.map(({ b, a }) => `<div class="review-item">
        <div class="behavior-head"><h3>${esc(b.description)}</h3>${badge(a.status)}</div>
        <p class="sub">Owner: ${esc(b.owner)} · Missing weeks: ${a.missingWeeks.map((w) => esc(fmtShort(w.date))).join(', ')}</p>
        <div class="form-grid">${decisionSelect(`gaps.${b.id}.decision`, GAP_DECISIONS)}${noteField(`gaps.${b.id}.note`)}</div>
      </div>`).join('') : '<p class="ok-note">Every completed week has a check-in. Nothing missing.</p>'}`;
    } else if (step === 2) {
      body = `<h2>Step 3: Unresolved barriers</h2>
      <p class="muted">Confirm which barriers have been dealt with. Ticked barriers are marked resolved when you save the review.</p>
      ${st.openBarriers.length ? st.openBarriers.map((x) => {
        const b = behaviorById(x.behaviorId);
        const checked = getPath(dr, `barriers.${x.id}.resolve`);
        return `<div class="review-item">
          <div>${barrierChip(x.category)} <span class="sub">Identified ${esc(fmtDate(x.identifiedDate))}</span></div>
          <p>${esc(x.description)}</p>
          <p class="sub">${esc(b.description)} · ${esc(b.owner)}</p>
          <label class="check"><input type="checkbox" data-draft="barriers.${esc(x.id)}.resolve" ${checked ? 'checked' : ''}> Mark as resolved</label>
          ${noteField(`barriers.${x.id}.note`, 'Resolution or next step', 'What was done, or what happens next?')}
        </div>`;
      }).join('') : '<p class="ok-note">No unresolved barriers for this rollout.</p>'}`;
    } else if (step === 3) {
      const withMeasure = st.rows.filter((x) => x.b.measure || isNum(x.b.baseline));
      body = `<h2>Step 4: Outcomes</h2>
      <p class="muted">Is adoption producing the expected business results? Compare the latest value with the baseline and target.</p>
      ${withMeasure.length ? `<div class="table-wrap"><table class="table responsive">
        <thead><tr><th>Behavior / measure</th><th class="num">Baseline</th><th class="num">Current</th><th class="num">Target</th><th>Progress</th></tr></thead>
        <tbody>${withMeasure.map(({ b, a }) => `<tr>
          <td data-label="Measure"><span class="strong">${esc(b.measure || 'Outcome')}</span><div class="sub">${esc(b.description)}</div></td>
          <td data-label="Baseline" class="num">${esc(fmtVal(b.baseline, b.unit))}</td>
          <td data-label="Current" class="num">${esc(a.current === null ? '-' : fmtVal(a.current, b.unit))}</td>
          <td data-label="Target" class="num">${esc(fmtVal(b.target, b.unit))}</td>
          <td data-label="Progress">${progressBar(a.progress)}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted">No measures defined for this rollout.</p>'}
      ${noteField('outcomeNotes', 'Observations about outcomes', 'For example: handling time is improving, quality has not moved yet.')}`;
    } else {
      const flagDecisions = st.flagged.filter(({ b }) => getPath(dr, `flags.${b.id}.decision`)).length;
      const gapDecisions = st.gaps.filter(({ b }) => getPath(dr, `gaps.${b.id}.decision`)).length;
      const toResolve = st.openBarriers.filter((x) => getPath(dr, `barriers.${x.id}.resolve`)).length;
      body = `<h2>Step 5: Sign off</h2>
      <ul class="check-summary">
        <li>${flagDecisions} of ${st.flagged.length} flagged behaviors have a decision</li>
        <li>${gapDecisions} of ${st.gaps.length} behaviors with missing check-ins have a decision</li>
        <li>${toResolve} of ${st.openBarriers.length} barriers will be marked resolved</li>
      </ul>
      <div class="form-grid">
        <label class="field"><span>Reviewer</span><input type="text" data-draft="reviewer" value="${esc(dr.reviewer)}" placeholder="Your name" autocomplete="name"></label>
        <label class="field"><span>Review date</span><input type="date" data-draft="date" value="${esc(dr.date)}"></label>
        <label class="field"><span>Next review date</span><input type="date" data-draft="nextReviewDate" value="${esc(dr.nextReviewDate)}"></label>
      </div>
      <fieldset class="field"><legend>Overall assessment</legend>
        <div class="radio-cards">${Object.entries(ASSESSMENTS).map(([k, v]) => `<label class="radio-card tone-${v.tone}"><input type="radio" name="assessment" value="${k}" data-draft="assessment" ${dr.assessment === k ? 'checked' : ''}><span>${esc(v.label)}</span></label>`).join('')}</div>
      </fieldset>
      ${noteField('notes', 'Summary and next actions', 'Key messages for the sponsor and the team.')}`;
    }

    return `<a class="back" href="#review">← All reviews</a>
    ${pageHead(`Review: ${r.tool}`, `${esc(r.team)} · Sponsor: ${esc(r.sponsor)}`)}
    ${stepper}
    <section class="card review-body">${body}</section>
    <div class="review-nav">
      ${step > 0 ? `<button class="btn" data-action="review-step" data-step="${step - 1}">Back</button>` : '<span></span>'}
      ${step < REVIEW_STEPS.length - 1 ? `<button class="btn primary" data-action="review-step" data-step="${step + 1}">Next: ${esc(REVIEW_STEPS[step + 1])}</button>`
        : '<button class="btn primary" data-action="save-review">Save review</button>'}
    </div>`;
  }

  function recentNotes(a) {
    const withNotes = a.reported.filter((w) => w.checkin.notes).slice(-2);
    if (!withNotes.length) return '';
    return `<ul class="notes">${withNotes.map((w) => `<li><span class="sub">${esc(fmtShort(w.date))}:</span> ${esc(w.checkin.notes)}</li>`).join('')}</ul>`;
  }

  function saveReview() {
    const dr = ui.reviewDraft;
    if (!dr) return;
    if (!dr.assessment) {
      toast('Choose an overall assessment before saving.', 'error');
      return;
    }
    if (!isISODate(dr.date)) {
      toast('Enter a review date.', 'error');
      return;
    }
    const st = rolloutStats(dr.rolloutId);
    const review = {
      id: uid(), rolloutId: dr.rolloutId, date: dr.date, reviewer: dr.reviewer.trim(),
      assessment: dr.assessment, nextReviewDate: isISODate(dr.nextReviewDate) ? dr.nextReviewDate : '',
      notes: dr.notes.trim(), outcomeNotes: dr.outcomeNotes.trim(),
      flagged: st.flagged.map(({ b, a }) => ({
        behaviorId: b.id, behavior: b.description, owner: b.owner, missedStreak: a.missedStreak,
        decision: getPath(dr, `flags.${b.id}.decision`) || '', note: (getPath(dr, `flags.${b.id}.note`) || '').trim(),
      })),
      gaps: st.gaps.map(({ b, a }) => ({
        behaviorId: b.id, behavior: b.description, owner: b.owner, missingTotal: a.missingTotal,
        decision: getPath(dr, `gaps.${b.id}.decision`) || '', note: (getPath(dr, `gaps.${b.id}.note`) || '').trim(),
      })),
      barriersResolved: [],
      snapshot: { behaviors: st.active.length, flagged: st.flagged.length, gaps: st.gaps.length, openBarriers: st.openBarriers.length },
      createdAt: new Date().toISOString(),
    };
    st.openBarriers.forEach((x) => {
      const note = (getPath(dr, `barriers.${x.id}.note`) || '').trim();
      if (getPath(dr, `barriers.${x.id}.resolve`)) {
        x.status = 'resolved';
        x.resolvedDate = dr.date;
        if (note) x.resolution = note;
        review.barriersResolved.push({ barrierId: x.id, category: x.category, description: x.description, note });
      } else if (note) {
        x.resolution = note;
      }
    });
    let paused = 0;
    review.flagged.forEach((f) => {
      if (f.decision === 'retire') {
        const b = behaviorById(f.behaviorId);
        if (b) { b.paused = true; paused++; }
      }
    });
    db.reviews.push(review);
    const rid = dr.rolloutId;
    ui.reviewDraft = null;
    location.hash = `#rollout-${rid}`;
    commit(`Review saved.${paused ? ` ${plural(paused, 'behavior')} paused.` : ''}`);
  }

  function showReview(id) {
    const rv = db.reviews.find((x) => x.id === id);
    if (!rv) return;
    const r = rolloutById(rv.rolloutId);
    const body = `<p>${assessmentBadge(rv.assessment)} <span class="sub">${esc(fmtDate(rv.date))} by ${esc(rv.reviewer || 'Unknown')}${rv.nextReviewDate ? ` · Next review ${esc(fmtDate(rv.nextReviewDate))}` : ''}</span></p>
      ${rv.notes ? `<h3>Summary and next actions</h3><p>${esc(rv.notes)}</p>` : ''}
      ${rv.outcomeNotes ? `<h3>Outcomes</h3><p>${esc(rv.outcomeNotes)}</p>` : ''}
      <h3>Missed 2+ weeks</h3>
      ${(rv.flagged || []).length ? `<ul class="notes">${rv.flagged.map((f) => `<li><strong>${esc(f.behavior)}</strong> (${esc(f.owner)}): ${esc(decisionLabel(FLAG_DECISIONS, f.decision))}${f.note ? `. ${esc(f.note)}` : ''}</li>`).join('')}</ul>` : '<p class="muted">None at the time of review.</p>'}
      <h3>Missing check-ins</h3>
      ${(rv.gaps || []).length ? `<ul class="notes">${rv.gaps.map((f) => `<li><strong>${esc(f.behavior)}</strong> (${esc(f.owner)}, ${plural(f.missingTotal, 'week')} missing): ${esc(decisionLabel(GAP_DECISIONS, f.decision))}${f.note ? `. ${esc(f.note)}` : ''}</li>`).join('')}</ul>` : '<p class="muted">None at the time of review.</p>'}
      <h3>Barriers resolved</h3>
      ${(rv.barriersResolved || []).length ? `<ul class="notes">${rv.barriersResolved.map((x) => `<li>${barrierChip(x.category)} ${esc(x.description)}${x.note ? `. ${esc(x.note)}` : ''}</li>`).join('')}</ul>` : '<p class="muted">None.</p>'}`;
    openModal({ title: `Review: ${r ? r.tool : ''}`, body, submitLabel: null });
  }

  /* ---- Import from ProcessIQ ---- */
  function viewImport() {
    const pending = db.imports.filter((x) => x.status === 'pending');
    const done = db.imports.filter((x) => x.status !== 'pending');
    const pv = ui.importPreview;
    return `${pageHead('Import ProcessIQ opportunities', 'Bring automation opportunities in from a CSV file and turn them into behaviors to track. ProcessIQ itself is not changed.')}
    <section class="card">
      <h2>1. Get the template</h2>
      <p>Fill in one row per opportunity. Only <strong>opportunity_id</strong> and <strong>proposed_behavior</strong> are required. Save as CSV (Excel and Numbers both can).</p>
      <div class="actions">
        <button class="btn" data-action="download-template">Download blank template</button>
        <button class="btn" data-action="download-template-example">Download example file</button>
      </div>
      <details><summary>Column guide</summary>
        <dl class="defs">
          <div><dt>opportunity_id</dt><dd>The ID from ProcessIQ, for example PIQ-1042. Required.</dd></div>
          <div><dt>process_name</dt><dd>The process the opportunity belongs to.</dd></div>
          <div><dt>opportunity_description</dt><dd>What the automation or AI does.</dd></div>
          <div><dt>proposed_behavior</dt><dd>What people should visibly do differently. Required.</dd></div>
          <div><dt>suggested_owner</dt><dd>Who will be accountable.</dd></div>
          <div><dt>expected_outcome</dt><dd>The business result you expect.</dd></div>
          <div><dt>outcome_measure</dt><dd>How you will measure it, for example "Hours to first response".</dd></div>
          <div><dt>baseline / target / unit</dt><dd>Numbers before and after, plus the unit (%, min, hours).</dd></div>
        </dl>
      </details>
    </section>

    <section class="card">
      <h2>2. Upload your CSV</h2>
      <label class="file-drop"><input type="file" accept=".csv,text/csv" data-change="import-file"><span>Choose a CSV file</span></label>
      ${pv ? `<div class="preview">
        <h3>Preview: ${esc(pv.fileName)}</h3>
        ${pv.error ? `<p class="banner tone-bad">${esc(pv.error)}</p>` : `
        <p class="sub">${plural(pv.rows.filter((x) => x.ok).length, 'row')} ready${pv.rows.some((x) => !x.ok) ? `, ${plural(pv.rows.filter((x) => !x.ok).length, 'row')} will be skipped` : ''}.</p>
        <div class="table-wrap"><table class="table responsive">
          <thead><tr><th>ID</th><th>Proposed behavior</th><th>Owner</th><th>Measure</th><th>Check</th></tr></thead>
          <tbody>${pv.rows.map((x) => `<tr class="${x.ok ? '' : 'is-error'}">
            <td data-label="ID">${esc(x.data.opportunity_id || '-')}</td>
            <td data-label="Behavior">${esc(x.data.proposed_behavior || '-')}</td>
            <td data-label="Owner">${esc(x.data.suggested_owner || '-')}</td>
            <td data-label="Measure">${esc(x.data.outcome_measure || '-')}${isNum(x.data.baseline) || isNum(x.data.target) ? `<div class="sub">${esc(fmtVal(x.data.baseline, x.data.unit))} → ${esc(fmtVal(x.data.target, x.data.unit))}</div>` : ''}</td>
            <td data-label="Check">${x.ok ? '<span class="badge tone-good">Ready</span>' : `<span class="badge tone-bad">Skip</span> <span class="small">${esc(x.problem)}</span>`}</td>
          </tr>`).join('')}</tbody></table></div>
        <div class="actions">
          <button class="btn primary" data-action="import-confirm" ${pv.rows.some((x) => x.ok) ? '' : 'disabled'}>Add ${plural(pv.rows.filter((x) => x.ok).length, 'opportunity', 'opportunities')} to the queue</button>
          <button class="btn" data-action="import-cancel">Cancel</button>
        </div>`}
      </div>` : ''}
    </section>

    <section class="card">
      <h2>3. Turn opportunities into behaviors <span class="count">${pending.length}</span></h2>
      <p class="muted small">Choose "Create behavior" to pick a rollout, confirm the wording and owner, and set check-in dates.</p>
      ${pending.length ? `<ul class="list">${pending.map((x) => `<li class="list-item">
        <div class="list-main">
          <div><span class="chip">${esc(x.opportunity_id)}</span> <strong>${esc(x.process_name || 'Unnamed process')}</strong></div>
          ${x.opportunity_description ? `<div class="sub">${esc(x.opportunity_description)}</div>` : ''}
          <p><span class="sub">Proposed behavior:</span> ${esc(x.proposed_behavior)}</p>
          <div class="sub">${x.suggested_owner ? `Owner: ${esc(x.suggested_owner)}` : 'No owner suggested'}${x.outcome_measure ? ` · ${esc(x.outcome_measure)}: ${esc(fmtVal(x.baseline, x.unit))} → ${esc(fmtVal(x.target, x.unit))}` : ''}</div>
        </div>
        <div class="actions">
          <button class="btn small primary" data-action="accept-import" data-id="${esc(x.id)}" ${db.rollouts.length ? '' : 'disabled title="Create a rollout first"'}>Create behavior</button>
          <button class="btn small" data-action="dismiss-import" data-id="${esc(x.id)}">Dismiss</button>
        </div>
      </li>`).join('')}</ul>` : '<p class="muted">The queue is empty.</p>'}
      ${!db.rollouts.length && pending.length ? '<p class="banner tone-warn">Create a rollout first, then come back to add these as behaviors.</p>' : ''}
      ${done.length ? `<details><summary>History (${done.length})</summary><ul class="list">${done.map((x) => `<li class="list-item">
        <div class="list-main"><div><span class="chip">${esc(x.opportunity_id)}</span> ${esc(x.proposed_behavior)}</div>
        <div class="sub">${x.status === 'accepted' ? 'Added as a behavior' : 'Dismissed'}</div></div>
        ${x.status === 'dismissed' ? `<div class="actions"><button class="btn small" data-action="restore-import" data-id="${esc(x.id)}">Restore</button></div>` : ''}
      </li>`).join('')}</ul></details>` : ''}
    </section>`;
  }

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const table = parseCSV(String(reader.result));
        if (table.length < 2) throw new Error('The file has no data rows.');
        const headers = table[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
        const missing = ['opportunity_id', 'proposed_behavior'].filter((c) => !headers.includes(c));
        if (missing.length) throw new Error(`Missing required column(s): ${missing.join(', ')}. Use the template from step 1.`);
        const known = new Set(db.imports.map((x) => x.opportunity_id).concat(db.behaviors.map((b) => b.sourceId)).filter(Boolean));
        const seen = new Set();
        const rows = table.slice(1)
          .filter((cells) => cells.some((c) => c.trim() !== ''))
          .map((cells) => {
            const data = {};
            IMPORT_COLUMNS.forEach((c) => {
              const i = headers.indexOf(c);
              data[c] = i >= 0 ? String(cells[i] ?? '').trim() : '';
            });
            let problem = '';
            if (!data.opportunity_id) problem = 'No opportunity_id';
            else if (!data.proposed_behavior) problem = 'No proposed_behavior';
            else if (known.has(data.opportunity_id)) problem = 'Already imported';
            else if (seen.has(data.opportunity_id)) problem = 'Duplicate in this file';
            else if ((data.baseline && !isNum(data.baseline)) || (data.target && !isNum(data.target))) problem = 'Baseline and target must be numbers';
            seen.add(data.opportunity_id);
            return { data, ok: !problem, problem };
          });
        ui.importPreview = { fileName: file.name, rows };
      } catch (e) {
        ui.importPreview = { fileName: file.name, rows: [], error: e.message };
      }
      render();
    };
    reader.onerror = () => toast('Could not read that file.', 'error');
    reader.readAsText(file);
  }

  /* ---- Exportable summary ---- */
  function viewSummary(id) {
    const scope = id && id !== 'all' ? [rolloutById(id)].filter(Boolean) : db.rollouts;
    if (!scope.length) return emptyState('Nothing to summarize', 'Create a rollout first.', '<a class="btn" href="#rollouts">Go to rollouts</a>');
    return `<div class="no-print">
      <a class="back" href="${id && id !== 'all' ? `#rollout-${esc(id)}` : '#dashboard'}">← Back</a>
      <div class="banner tone-info">
        <div>${EMBEDDED ? `Copy this summary as plain text to paste into an email${canDownload() ? ', or download it as a spreadsheet' : ''}. Printing works when you open the app from its folder.` : 'This page is designed to print cleanly. Use <strong>Print / Save as PDF</strong> to share it, or copy it as plain text into an email.'}</div>
        <div class="actions">
          ${EMBEDDED ? '' : '<button class="btn primary small" data-action="print">Print / Save as PDF</button>'}
          <button class="btn small" data-action="copy-summary" data-id="${esc(id || 'all')}">Copy as text</button>
          <button class="btn small" data-action="export-behaviors" data-id="${esc(id || 'all')}">Download CSV</button>
        </div>
      </div>
    </div>
    <article class="report">
      <header class="report-head">
        <h1>AI Adoption Follow-Through Summary</h1>
        <p class="sub">Generated ${esc(fmtDate(todayISO()))}${db.meta.sample ? ' · Contains fictional example data' : ''}</p>
      </header>
      ${scope.map((r) => {
        const st = rolloutStats(r.id);
        const rev = latestReview(r.id);
        return `<section class="report-section">
          <h2>${esc(r.tool)}</h2>
          <p class="sub">${esc(r.team)} · Sponsor: ${esc(r.sponsor)} · Launched ${esc(fmtDate(r.launchDate))}</p>
          ${r.purpose ? `<p>${esc(r.purpose)}</p>` : ''}
          <div class="report-kpis">
            <div><strong>${st.active.length}</strong><span>behaviors tracked</span></div>
            <div><strong>${st.adopting.length}</strong><span>on track or sustained</span></div>
            <div><strong>${st.flagged.length}</strong><span>missed 2+ weeks</span></div>
            <div><strong>${st.missingWeeks}</strong><span>missing check-ins</span></div>
            <div><strong>${st.openBarriers.length}</strong><span>unresolved barriers</span></div>
          </div>
          <p><strong>Latest manager review:</strong> ${rev ? `${esc(fmtDate(rev.date))} by ${esc(rev.reviewer || 'Unknown')} ${assessmentBadge(rev.assessment)}${rev.nextReviewDate ? ` · Next review ${esc(fmtDate(rev.nextReviewDate))}` : ''}` : 'None yet'}</p>
          ${rev && rev.notes ? `<p class="quote">${esc(rev.notes)}</p>` : ''}
          ${st.rows.length ? `<table class="table responsive report-table">
            <thead><tr><th>Behavior</th><th>Owner</th><th>Status</th><th class="num">Missed in a row</th><th class="num">Missing</th><th>Outcome (baseline / current / target)</th></tr></thead>
            <tbody>${st.rows.map(({ b, a }) => `<tr>
              <td data-label="Behavior">${esc(b.description)}</td><td data-label="Owner">${esc(b.owner)}</td>
              <td data-label="Status">${badge(a.status)}<div class="sub">${esc(statusReason(a))}</div></td>
              <td data-label="Missed in a row" class="num">${a.missedStreak}</td><td data-label="Missing" class="num">${a.missingTotal}</td>
              <td data-label="Outcome">${b.measure ? `${esc(b.measure)}: ${esc(fmtVal(b.baseline, b.unit))} / ${esc(a.current === null ? '-' : fmtVal(a.current, b.unit))} / ${esc(fmtVal(b.target, b.unit))}${a.progress !== null ? ` <span class="sub">(${a.progress}% to target)</span>` : ''}` : '-'}</td>
            </tr>`).join('')}</tbody></table>` : '<p class="muted">No behaviors defined.</p>'}
          ${st.openBarriers.length ? `<h3>Unresolved barriers</h3><ul class="notes">${st.openBarriers.map((x) => {
            const b = behaviorById(x.behaviorId);
            return `<li>${barrierChip(x.category)} ${esc(x.description)} <span class="sub">(${esc(b.owner)}, since ${esc(fmtDate(x.identifiedDate))})</span></li>`;
          }).join('')}</ul>` : ''}
          ${rev && ((rev.flagged || []).length || (rev.gaps || []).length) ? `<h3>Decisions from the latest review</h3><ul class="notes">
            ${(rev.flagged || []).map((f) => `<li><strong>${esc(f.behavior)}:</strong> ${esc(decisionLabel(FLAG_DECISIONS, f.decision))}${f.note ? `. ${esc(f.note)}` : ''}</li>`).join('')}
            ${(rev.gaps || []).map((f) => `<li><strong>${esc(f.behavior)} (missing check-ins):</strong> ${esc(decisionLabel(GAP_DECISIONS, f.decision))}${f.note ? `. ${esc(f.note)}` : ''}</li>`).join('')}
          </ul>` : ''}
        </section>`;
      }).join('')}
    </article>`;
  }

  function summaryText(id) {
    const scope = id && id !== 'all' ? [rolloutById(id)].filter(Boolean) : db.rollouts;
    const lines = ['AI ADOPTION FOLLOW-THROUGH SUMMARY', `Generated ${fmtDate(todayISO())}`, ''];
    if (db.meta.sample) lines.push('(Contains fictional example data)', '');
    scope.forEach((r) => {
      const st = rolloutStats(r.id);
      const rev = latestReview(r.id);
      lines.push(r.tool.toUpperCase());
      lines.push(`Team: ${r.team} | Sponsor: ${r.sponsor} | Launched: ${fmtDate(r.launchDate)}`);
      lines.push(`Behaviors: ${st.active.length} tracked, ${st.adopting.length} on track or sustained, ${st.flagged.length} missed 2+ weeks, ${st.missingWeeks} missing check-ins, ${st.openBarriers.length} unresolved barriers`);
      lines.push(rev ? `Latest review: ${fmtDate(rev.date)} by ${rev.reviewer || 'Unknown'}, ${ASSESSMENTS[rev.assessment] ? ASSESSMENTS[rev.assessment].label : ''}` : 'Latest review: none yet');
      if (rev && rev.notes) lines.push(`Review notes: ${rev.notes}`);
      lines.push('');
      st.rows.forEach(({ b, a }) => {
        lines.push(`- [${BEHAVIOR_STATUS[a.status].label}] ${b.description} (Owner: ${b.owner})`);
        lines.push(`  ${statusReason(a)}`);
        if (b.measure) lines.push(`  ${b.measure}: baseline ${fmtVal(b.baseline, b.unit)}, current ${a.current === null ? '-' : fmtVal(a.current, b.unit)}, target ${fmtVal(b.target, b.unit)}${a.progress !== null ? ` (${a.progress}% to target)` : ''}`);
        a.openBarriers.forEach((x) => lines.push(`  Barrier (${barrierLabel(x.category)}): ${x.description}`));
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  /* ---- Data, backup and export ---- */
  function viewData() {
    const last = db.meta.lastBackupAt;
    let bytes = 0;
    try { bytes = new Blob([JSON.stringify(db)]).size; } catch (_) { /* ignore */ }
    return `${pageHead('Data, backup and export', 'Your data is saved automatically in this browser, on this device only.')}
    ${EMBEDDED && !canDownload() ? '<div class="banner tone-warn"><div><strong>This is a preview.</strong> Downloads (backup, CSV, template) are blocked here. Open <code>index.html</code> from the app folder for the full version. Restore from a backup file still works.</div></div>' : ''}
    ${EMBEDDED && canDownload() ? '<div class="banner tone-info"><div><strong>This is a preview.</strong> Each download asks you to confirm before the file is saved. Data entered here stays in this browser, separate from the app on your Mac.</div></div>' : ''}
    ${banners()}
    <div class="grid-2">
      <section class="card">
        <h2>Backup</h2>
        <p>Download a single backup file of everything. Keep it somewhere safe, like your Documents folder or a shared drive. Use it to move your data to another computer or browser.</p>
        <p class="sub">Last backup: ${last ? esc(fmtStamp(last)) : 'never'} · Current data size: ${(bytes / 1024).toFixed(1)} KB</p>
        <div class="actions"><button class="btn primary" data-action="backup">Download backup (.json)</button></div>
      </section>
      <section class="card">
        <h2>Restore</h2>
        <p>Load a backup file. <strong>This replaces everything currently in the tracker</strong>, so download a backup first if you need it.</p>
        <label class="file-drop"><input type="file" accept=".json,application/json" data-change="restore-file"><span>Choose a backup file</span></label>
      </section>
    </div>
    <section class="card">
      <h2>Export</h2>
      <p>Spreadsheet files (CSV) open in Excel, Numbers, or Google Sheets.</p>
      <div class="actions wrap">
        <a class="btn" href="#summary-all">Printable summary</a>
        <button class="btn" data-action="export-behaviors" data-id="all">Behavior status (.csv)</button>
        <button class="btn" data-action="export-checkins">Check-in history (.csv)</button>
        <button class="btn" data-action="export-barriers">Barriers (.csv)</button>
        <button class="btn" data-action="export-reviews">Manager reviews (.csv)</button>
      </div>
    </section>
    <section class="card">
      <h2>Start over</h2>
      <div class="actions wrap">
        <button class="btn" data-action="load-sample">Replace with example data</button>
        <button class="btn danger" data-action="start-fresh">Erase everything and start blank</button>
      </div>
    </section>`;
  }

  /* ---- Guide ---- */
  function viewGuide() {
    return `${pageHead('How this tracker works', 'A plain-English guide for managers and change leads.')}
    <section class="card prose">
      <h2>How it works each week</h2>
      <ol>
        <li><strong>Create a rollout.</strong> One AI tool, one team, a sponsor, and a launch date.</li>
        <li><strong>Define the expected behaviors.</strong> Write what you would actually see someone do, name one accountable owner, set the weekly check-in dates, and describe the business outcome with a baseline and target.</li>
        <li><strong>Check in every week.</strong> For each behavior, record Used, Partly used, or Not used. Add notes, evidence (a link or a short description), and the latest measure value if you have it.</li>
        <li><strong>Log barriers when you hear them.</strong> Skills, time, access, workflow design, willingness, or unknown.</li>
        <li><strong>Run a manager review.</strong> The five-step review walks through flagged behaviors, missing check-ins, barriers, and outcomes, then records your decisions.</li>
        <li><strong>Share the summary</strong> with the sponsor as a PDF or plain text.</li>
      </ol>
    </section>
    <section class="card prose">
      <h2>How the flags are calculated</h2>
      <dl class="defs">
        <div><dt>Completed week</dt><dd>A week counts once a check-in is recorded, or once its check-in date has passed without one.</dd></div>
        <div><dt>${badge('flagged')}</dt><dd>The two most recent completed weeks (or more) were both reported <strong>Not used</strong>.</dd></div>
        <div><dt>${badge('gap')}</dt><dd>The most recent completed week has no check-in. Missing data is never counted as nonuse. It is tracked separately so you can tell "nobody reported" apart from "it did not happen".</dd></div>
        <div><dt>${badge('watch')}</dt><dd>The most recent week was Partly used, or a single week of Not used.</dd></div>
        <div><dt>${badge('on_track')}</dt><dd>The most recent week was Used.</dd></div>
        <div><dt>${badge('sustained')}</dt><dd>Used for ${SUSTAINED_WEEKS} or more weeks in a row.</dd></div>
        <div><dt>Partly used</dt><dd>Shows as a caution but does not count toward the two-week flag.</dd></div>
        <div><dt>Adoption %</dt><dd>Share of reported weeks that were Used, counting Partly used as half.</dd></div>
        <div><dt>Current value</dt><dd>The latest measure value entered in a check-in. If none, the starting "current value" on the behavior.</dd></div>
        <div><dt>Progress to target</dt><dd>How far the current value has moved from baseline toward target. Works for measures that should go down (like handling time) or up.</dd></div>
      </dl>
    </section>
    <section class="card prose">
      <h2>Writing a good behavior</h2>
      <p>A good behavior is something another person could observe and confirm. Compare:</p>
      <ul>
        <li><span class="badge tone-bad">Vague</span> "Embraces the new AI tool."</li>
        <li><span class="badge tone-good">Observable</span> "Uses the AI draft as the starting point for every first reply to a complaint."</li>
      </ul>
    </section>
    <section class="card prose">
      <h2>Where your data lives</h2>
      <p>Everything is stored in this browser on this device. Nothing is sent anywhere. Clearing your browser history or site data can erase it, so download a backup from the <a href="#data">Data page</a> regularly. The tracker reminds you every ${BACKUP_REMINDER_DAYS} days.</p>
    </section>`;
  }

  /* ------------------------------------------------------------------------
     8. Forms (shown in a pop-up dialog)
     ------------------------------------------------------------------------ */
  const modal = $('#modal');
  let modalSubmit = null;

  function openModal({ title, body, submitLabel = 'Save', onSubmit, footerExtra = '', wide = false }) {
    modalSubmit = onSubmit || null;
    modal.classList.toggle('wide', wide);
    modal.innerHTML = `<form id="modal-form" class="modal-form" method="dialog">
      <header class="modal-head"><h2 id="modal-title">${esc(title)}</h2>
        <button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">×</button></header>
      <div class="modal-body">${body}</div>
      <footer class="modal-foot">${footerExtra}<span class="spacer"></span>
        <button type="button" class="btn" data-action="close-modal">${submitLabel ? 'Cancel' : 'Close'}</button>
        ${submitLabel ? `<button type="submit" class="btn primary">${esc(submitLabel)}</button>` : ''}
      </footer>
    </form>`;
    if (!modal.open) modal.showModal();
    const first = modal.querySelector('.modal-body input:not([type=hidden]):not([type=radio]), .modal-body textarea, .modal-body select');
    if (first && window.matchMedia('(hover: hover)').matches) first.focus();
  }

  /** Ask a yes/no question inside the page (browser pop-ups are not used). */
  function askConfirm(message, onYes, yesLabel = 'Yes, continue') {
    openModal({
      title: 'Please confirm',
      body: message.split('\n\n').map((t) => `<p>${esc(t)}</p>`).join(''),
      submitLabel: yesLabel,
      onSubmit() { onYes(); return true; },
    });
  }

  function closeModal() {
    if (modal.open) modal.close();
    modalSubmit = null;
  }

  modal.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!modalSubmit) { closeModal(); return; }
    const form = e.target;
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = typeof v === 'string' ? v.trim() : v; });
    if (modalSubmit(data, form) !== false) closeModal();
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  const field = (label, input, hint = '') => `<label class="field"><span>${label}</span>${input}${hint ? `<small class="hint">${hint}</small>` : ''}</label>`;

  /* ---- Rollout form ---- */
  function rolloutForm(r) {
    const v = r || { tool: '', team: '', sponsor: '', launchDate: todayISO(), purpose: '' };
    openModal({
      title: r ? 'Edit rollout' : 'New rollout',
      body: `${field('AI tool name', `<input name="tool" required value="${esc(v.tool)}" placeholder="For example: ClaimsPilot AI">`)}
        ${field('Team', `<input name="team" required value="${esc(v.team)}" placeholder="Who is adopting it?">`)}
        ${field('Sponsor', `<input name="sponsor" required value="${esc(v.sponsor)}" placeholder="Name and role">`)}
        ${field('Launch date', `<input type="date" name="launchDate" required value="${esc(v.launchDate)}">`)}
        ${field('Purpose (optional)', `<textarea name="purpose" rows="2" placeholder="Why this rollout matters, in one or two sentences.">${esc(v.purpose)}</textarea>`)}`,
      onSubmit(d) {
        if (!isISODate(d.launchDate)) { toast('Enter a valid launch date.', 'error'); return false; }
        if (r) {
          Object.assign(r, { tool: d.tool, team: d.team, sponsor: d.sponsor, launchDate: d.launchDate, purpose: d.purpose });
          commit('Rollout updated.');
        } else {
          const nr = { id: uid(), tool: d.tool, team: d.team, sponsor: d.sponsor, launchDate: d.launchDate, purpose: d.purpose, createdAt: new Date().toISOString() };
          db.rollouts.push(nr);
          location.hash = `#rollout-${nr.id}`;
          commit('Rollout created. Next, add the behaviors you expect to see.');
        }
        return true;
      },
    });
  }

  /* ---- Behavior form ---- */
  function behaviorForm(b, preset = {}) {
    const rolloutId = (b && b.rolloutId) || preset.rolloutId || (ui.rolloutFilter !== 'all' ? ui.rolloutFilter : (db.rollouts[0] || {}).id);
    const r = rolloutById(rolloutId);
    const defaultFirst = r ? addDays(r.launchDate, 7) : todayISO();
    const v = b || {
      description: '', owner: '', firstCheckin: defaultFirst, weeks: 8, outcome: '', measure: '',
      baseline: '', target: '', unit: '', current: '', paused: false, ...preset,
    };
    const opts = db.rollouts.map((x) => `<option value="${esc(x.id)}" ${x.id === rolloutId ? 'selected' : ''}>${esc(x.tool)} (${esc(x.team)})</option>`).join('');
    openModal({
      title: b ? 'Edit behavior' : (preset.importId ? 'Create behavior from ProcessIQ' : 'New behavior'),
      wide: true,
      body: `${preset.importId ? `<p class="banner tone-info">From ProcessIQ opportunity <strong>${esc(preset.sourceId)}</strong>. Review and adjust before saving.</p>` : ''}
        ${field('Rollout', `<select name="rolloutId" required>${opts}</select>`)}
        ${field('Observable behavior', `<textarea name="description" rows="2" required placeholder="What would someone see this person do? For example: Uses the AI draft as the starting point for every customer reply.">${esc(v.description)}</textarea>`, 'Describe an action someone could see and confirm, not an attitude.')}
        ${field('Accountable owner', `<input name="owner" required value="${esc(v.owner)}" placeholder="One named person">`)}
        <div class="form-grid">
          ${field('First weekly check-in', `<input type="date" name="firstCheckin" required value="${esc(v.firstCheckin)}" data-preview="weeks">`)}
          ${field('Number of weekly check-ins', `<input type="number" name="weeks" min="1" max="104" required value="${esc(v.weeks)}" data-preview="weeks">`)}
        </div>
        <p class="hint" id="week-preview">${esc(weekPreview(v.firstCheckin, v.weeks))}</p>
        <fieldset class="fieldset"><legend>Expected business outcome</legend>
          ${field('Outcome', `<input name="outcome" value="${esc(v.outcome)}" placeholder="For example: Faster first response to complaints">`)}
          ${field('Measure', `<input name="measure" value="${esc(v.measure)}" placeholder="For example: Hours to first response">`)}
          <div class="form-grid four">
            ${field('Baseline', `<input type="number" step="any" name="baseline" value="${esc(v.baseline)}" inputmode="decimal">`)}
            ${field('Target', `<input type="number" step="any" name="target" value="${esc(v.target)}" inputmode="decimal">`)}
            ${field('Unit', `<input name="unit" value="${esc(v.unit)}" placeholder="%, min, hours" list="unit-list">`)}
            ${field('Current value', `<input type="number" step="any" name="current" value="${esc(v.current)}" inputmode="decimal">`, 'Optional. Weekly check-ins can update it.')}
          </div>
          <datalist id="unit-list"><option value="%"><option value="min"><option value="hours"><option value="days"><option value="$"><option value="per week"></datalist>
        </fieldset>
        ${b ? `<label class="check"><input type="checkbox" name="paused" ${v.paused ? 'checked' : ''}> Paused or retired (keep the history, leave it out of dashboard totals)</label>` : ''}`,
      onSubmit(d) {
        const weeks = parseInt(d.weeks, 10);
        if (!isISODate(d.firstCheckin) || !(weeks >= 1 && weeks <= 104)) { toast('Check the first check-in date and number of weeks (1 to 104).', 'error'); return false; }
        const fields = {
          rolloutId: d.rolloutId, description: d.description, owner: d.owner, firstCheckin: d.firstCheckin, weeks,
          outcome: d.outcome, measure: d.measure, baseline: d.baseline, target: d.target, unit: d.unit, current: d.current,
        };
        if (b) {
          const newDates = new Set(scheduleFor(fields));
          const orphans = db.checkins.filter((c) => c.behaviorId === b.id && !newDates.has(c.weekDate));
          const apply = () => {
            db.checkins = db.checkins.filter((c) => !orphans.includes(c));
            if (b.rolloutId !== fields.rolloutId) db.barriers.forEach((x) => { if (x.behaviorId === b.id) x.rolloutId = fields.rolloutId; });
            Object.assign(b, fields, { paused: d.paused === 'on' });
            commit('Behavior updated.');
          };
          if (orphans.length) {
            askConfirm(`${plural(orphans.length, 'recorded check-in')} fall outside the new schedule and will be deleted.\n\nSave the new schedule anyway?`, apply, 'Save and delete them');
            return false;
          }
          apply();
        } else {
          const nb = { id: uid(), ...fields, paused: false, source: preset.importId ? 'processiq' : 'manual', sourceId: preset.sourceId || '', createdAt: new Date().toISOString() };
          db.behaviors.push(nb);
          if (preset.importId) {
            const imp = db.imports.find((x) => x.id === preset.importId);
            if (imp) { imp.status = 'accepted'; imp.behaviorId = nb.id; }
          }
          commit(preset.importId ? 'Behavior created from ProcessIQ opportunity.' : 'Behavior added.');
        }
        return true;
      },
    });
  }

  function weekPreview(first, weeks) {
    const n = parseInt(weeks, 10);
    if (!isISODate(first) || !(n >= 1)) return '';
    const last = addDays(first, (Math.min(n, 104) - 1) * 7);
    return `Check-ins every 7 days: ${fmtDate(first)} to ${fmtDate(last)} (${plural(Math.min(n, 104), 'check-in')}).`;
  }

  /* ---- Check-in form ---- */
  function checkinForm(bid, date) {
    const b = behaviorById(bid);
    if (!b) return;
    const a = analyze(b);
    const week = a.weeks.find((w) => w.date === date);
    if (!week || week.state === 'upcoming') { toast('That check-in date has not arrived yet.', 'error'); return; }
    const c = week.checkin;
    const options = a.weeks.filter((w) => w.state !== 'upcoming')
      .map((w) => `<option value="${w.date}" ${w.date === date ? 'selected' : ''}>${esc(fmtDate(w.date))} (${esc(WEEK_STATE[w.state].label)})</option>`).join('');
    openModal({
      title: c ? 'Edit check-in' : 'Record check-in',
      body: `<p class="strong">${esc(b.description)}</p>
        <p class="sub">Owner: ${esc(b.owner)}</p>
        ${field('Week', `<select data-change="checkin-week" data-b="${esc(b.id)}">${options}</select>`)}
        <fieldset class="field"><legend>Was the behavior used this week?</legend>
          <div class="radio-cards three">${Object.entries(CHECKIN_STATUS).map(([k, s]) => `<label class="radio-card st-${k}"><input type="radio" name="status" value="${k}" required ${c && c.status === k ? 'checked' : ''}><span><i aria-hidden="true">${s.icon}</i> ${esc(s.label)}</span></label>`).join('')}</div>
        </fieldset>
        ${field('Notes', `<textarea name="notes" rows="3" placeholder="What did you observe? What got in the way?">${esc(c ? c.notes : '')}</textarea>`)}
        ${field('Evidence (optional)', `<input name="evidence" value="${esc(c ? c.evidence : '')}" placeholder="A link, file name, or short description">`, 'For example a report name, a screenshot location, or a link to a shared file.')}
        ${b.measure ? field(`${esc(b.measure)} this week (optional)`, `<input type="number" step="any" inputmode="decimal" name="measureValue" value="${esc(c ? c.measureValue : '')}" placeholder="${esc(b.unit || '')}">`, `Baseline ${esc(fmtVal(b.baseline, b.unit))}, target ${esc(fmtVal(b.target, b.unit))}.`) : ''}
        <details class="inline-barrier"><summary>Log a possible barrier with this check-in</summary>
          ${field('Barrier type', `<select name="barrierCategory"><option value="">Choose...</option>${BARRIER_TYPES.map((t) => `<option value="${t.id}">${esc(t.label)}: ${esc(t.hint)}</option>`).join('')}</select>`)}
          ${field('What is getting in the way?', '<textarea name="barrierDescription" rows="2"></textarea>')}
        </details>`,
      footerExtra: c ? `<button type="button" class="btn ghost danger-text" data-action="delete-checkin" data-id="${esc(c.id)}">Delete</button>` : '',
      onSubmit(d) {
        if (!CHECKIN_STATUS[d.status]) { toast('Choose Used, Partly used, or Not used.', 'error'); return false; }
        const fields = { status: d.status, notes: d.notes || '', evidence: d.evidence || '', measureValue: isNum(d.measureValue) ? Number(d.measureValue) : '' };
        if (c) Object.assign(c, fields, { updatedAt: new Date().toISOString() });
        else db.checkins.push({ id: uid(), behaviorId: b.id, weekDate: date, ...fields, recordedAt: new Date().toISOString() });
        let msg = 'Check-in saved.';
        if (d.barrierCategory || d.barrierDescription) {
          db.barriers.push({
            id: uid(), behaviorId: b.id, rolloutId: b.rolloutId, category: d.barrierCategory || 'unknown',
            description: d.barrierDescription || '', identifiedDate: date > todayISO() ? todayISO() : date,
            status: 'open', resolution: '', resolvedDate: '', createdAt: new Date().toISOString(),
          });
          msg = 'Check-in and barrier saved.';
        }
        const after = analyze(b);
        if (after.status === 'flagged' && a.status !== 'flagged') msg += ' This behavior is now flagged: missed 2+ weeks in a row.';
        commit(msg);
        return true;
      },
    });
  }

  /* ---- Barrier form ---- */
  function barrierForm(x, preset = {}) {
    const v = x || { behaviorId: preset.behaviorId || '', category: '', description: '', identifiedDate: todayISO(), status: 'open', resolution: '' };
    const groups = db.rollouts
      .filter((r) => !preset.rolloutId || r.id === preset.rolloutId)
      .map((r) => {
        const bs = db.behaviors.filter((b) => b.rolloutId === r.id);
        if (!bs.length) return '';
        return `<optgroup label="${esc(r.tool)}">${bs.map((b) => `<option value="${esc(b.id)}" ${b.id === v.behaviorId ? 'selected' : ''}>${esc(b.owner)}: ${esc(b.description.length > 70 ? `${b.description.slice(0, 70)}...` : b.description)}</option>`).join('')}</optgroup>`;
      }).join('');
    openModal({
      title: x ? 'Edit barrier' : 'Log a possible barrier',
      body: `${field('Behavior', `<select name="behaviorId" required><option value="">Choose a behavior...</option>${groups}</select>`)}
        <fieldset class="field"><legend>Barrier type</legend>
          <div class="radio-cards two">${BARRIER_TYPES.map((t) => `<label class="radio-card"><input type="radio" name="category" value="${t.id}" required ${v.category === t.id ? 'checked' : ''}><span><strong>${esc(t.label)}</strong><small>${esc(t.hint)}</small></span></label>`).join('')}</div>
        </fieldset>
        ${field('What is getting in the way?', `<textarea name="description" rows="3" required placeholder="Describe what you heard or observed.">${esc(v.description)}</textarea>`)}
        <div class="form-grid">
          ${field('Identified on', `<input type="date" name="identifiedDate" required value="${esc(v.identifiedDate)}">`)}
          ${field('Status', `<select name="status"><option value="open" ${v.status === 'open' ? 'selected' : ''}>Unresolved</option><option value="resolved" ${v.status === 'resolved' ? 'selected' : ''}>Resolved</option></select>`)}
        </div>
        ${field('Resolution or next step (optional)', `<textarea name="resolution" rows="2">${esc(v.resolution)}</textarea>`)}`,
      onSubmit(d) {
        const b = behaviorById(d.behaviorId);
        if (!b) { toast('Choose a behavior.', 'error'); return false; }
        const fields = {
          behaviorId: b.id, rolloutId: b.rolloutId, category: d.category, description: d.description,
          identifiedDate: isISODate(d.identifiedDate) ? d.identifiedDate : todayISO(), status: d.status === 'resolved' ? 'resolved' : 'open', resolution: d.resolution,
        };
        if (x) {
          if (fields.status === 'resolved' && x.status !== 'resolved') fields.resolvedDate = todayISO();
          if (fields.status === 'open') fields.resolvedDate = '';
          Object.assign(x, fields);
          commit('Barrier updated.');
        } else {
          db.barriers.push({ id: uid(), ...fields, resolvedDate: fields.status === 'resolved' ? todayISO() : '', createdAt: new Date().toISOString() });
          commit('Barrier logged.');
        }
        return true;
      },
    });
  }

  function resolveForm(x) {
    openModal({
      title: 'Mark barrier resolved',
      body: `<p>${barrierChip(x.category)} ${esc(x.description)}</p>
        ${field('How was it resolved?', `<textarea name="resolution" rows="3" placeholder="For example: IT granted access on Tuesday.">${esc(x.resolution || '')}</textarea>`)}`,
      submitLabel: 'Mark resolved',
      onSubmit(d) {
        Object.assign(x, { status: 'resolved', resolution: d.resolution, resolvedDate: todayISO() });
        commit('Barrier resolved.');
        return true;
      },
    });
  }

  /* ------------------------------------------------------------------------
     9. Files: CSV, downloads, backup and restore
     ------------------------------------------------------------------------ */
  function parseCSV(text) {
    const s = String(text).replace(/^﻿/, '');
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"') {
          if (s[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function csvCell(v) {
    let s = v === null || v === undefined ? '' : String(v);
    // Stop spreadsheet apps from treating text as a formula.
    if (/^[=+\-@]/.test(s) && !isNum(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const toCSV = (header, rows) => `﻿${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

  // In a shared preview link, files are saved through the viewer's own
  // download prompt. This stays null when the app is opened from its folder.
  let previewDownloads = null;
  if (EMBEDDED && window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then((d) => { if (d) { previewDownloads = d; render(); } }).catch(() => {});
  }
  const canDownload = () => !EMBEDDED || !!previewDownloads;

  /** Save a file. Resolves true when the file was handed over, false otherwise. */
  async function download(filename, content, type) {
    if (previewDownloads) {
      try {
        await previewDownloads.save({ filename, data: content });
        return true;
      } catch (e) {
        const code = e && e.code;
        if (code === 'declined') toast('Download cancelled.');
        else if (code === 'rate_limited') toast('A download prompt is already open. Finish that one first.', 'error');
        else toast('This preview could not save the file. Open index.html from the app folder instead.', 'error');
        return false;
      }
    }
    if (EMBEDDED) {
      toast('Downloads are blocked in this preview. Open index.html from the app folder to download files.', 'error');
      return false;
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }
  const stamp = () => todayISO();

  function exportBehaviors(id) {
    const rows = behaviorRows(id || 'all').map(({ b, r, a }) => [
      r.tool, r.team, r.sponsor, b.description, b.owner, BEHAVIOR_STATUS[a.status].label, statusReason(a),
      a.missedStreak, a.missingTotal, a.reported.length, a.counts.used, a.counts.partly, a.counts.not_used,
      a.adoptionRate === null ? '' : a.adoptionRate, b.outcome, b.measure, b.baseline, a.current === null ? '' : a.current, b.target, b.unit,
      a.progress === null ? '' : a.progress, a.openBarriers.length, b.firstCheckin, b.weeks, b.source === 'processiq' ? b.sourceId : '',
    ]);
    download(`adoption-behavior-status-${stamp()}.csv`, toCSV([
      'Rollout', 'Team', 'Sponsor', 'Behavior', 'Owner', 'Status', 'Status reason', 'Missed in a row', 'Missing check-ins',
      'Weeks reported', 'Used', 'Partly used', 'Not used', 'Adoption %', 'Expected outcome', 'Measure', 'Baseline', 'Current', 'Target', 'Unit',
      'Progress to target %', 'Open barriers', 'First check-in', 'Weeks scheduled', 'ProcessIQ ID',
    ], rows), 'text/csv;charset=utf-8');
  }

  function exportCheckins() {
    const rows = [];
    db.behaviors.forEach((b) => {
      const r = rolloutById(b.rolloutId);
      if (!r) return;
      analyze(b).completed.forEach((w) => {
        const c = w.checkin;
        rows.push([r.tool, b.description, b.owner, w.date, c ? CHECKIN_STATUS[c.status].label : 'No check-in (missing)',
          c ? c.notes : '', c ? c.evidence : '', c ? c.measureValue : '', c ? c.recordedAt : '']);
      });
    });
    rows.sort((x, y) => String(x[0]).localeCompare(String(y[0])) || String(x[3]).localeCompare(String(y[3])));
    download(`adoption-checkins-${stamp()}.csv`, toCSV(['Rollout', 'Behavior', 'Owner', 'Week', 'Status', 'Notes', 'Evidence', 'Measure value', 'Recorded at'], rows), 'text/csv;charset=utf-8');
  }

  function exportBarriers() {
    const rows = db.barriers.map((x) => {
      const b = behaviorById(x.behaviorId) || {};
      const r = rolloutById(x.rolloutId) || {};
      return [r.tool, b.description, b.owner, barrierLabel(x.category), x.description, x.status === 'open' ? 'Unresolved' : 'Resolved', x.identifiedDate, x.resolvedDate, x.resolution];
    });
    download(`adoption-barriers-${stamp()}.csv`, toCSV(['Rollout', 'Behavior', 'Owner', 'Barrier type', 'Description', 'Status', 'Identified', 'Resolved', 'Resolution'], rows), 'text/csv;charset=utf-8');
  }

  function exportReviews() {
    const rows = db.reviews.map((rv) => {
      const r = rolloutById(rv.rolloutId) || {};
      const decisions = [
        ...(rv.flagged || []).map((f) => `${f.behavior}: ${decisionLabel(FLAG_DECISIONS, f.decision)}${f.note ? ` (${f.note})` : ''}`),
        ...(rv.gaps || []).map((f) => `${f.behavior} [missing check-ins]: ${decisionLabel(GAP_DECISIONS, f.decision)}${f.note ? ` (${f.note})` : ''}`),
      ].join(' | ');
      return [r.tool, rv.date, rv.reviewer, ASSESSMENTS[rv.assessment] ? ASSESSMENTS[rv.assessment].label : '', rv.nextReviewDate,
        (rv.snapshot || {}).flagged, (rv.snapshot || {}).gaps, (rv.barriersResolved || []).length, decisions, rv.outcomeNotes, rv.notes];
    });
    download(`adoption-reviews-${stamp()}.csv`, toCSV(['Rollout', 'Review date', 'Reviewer', 'Assessment', 'Next review', 'Flagged behaviors', 'Behaviors with missing check-ins', 'Barriers resolved', 'Decisions', 'Outcome notes', 'Summary'], rows), 'text/csv;charset=utf-8');
  }

  function downloadTemplate(withExample) {
    const rows = withExample ? [
      ['PIQ-2001', 'Invoice exception handling', 'AI suggests the likely cause of each invoice exception.', 'Checks the AI-suggested cause before contacting the vendor on every exception.', 'Riley Patel', 'Exceptions resolved faster.', 'Days to resolve an exception', '6', '3', 'days'],
      ['PIQ-2002', 'New hire onboarding', 'AI assistant answers common policy questions.', 'Points new hires to the AI assistant before answering policy questions directly.', 'Casey Morgan', 'Less HR time on routine questions.', 'Routine HR tickets per week', '40', '20', 'tickets'],
    ] : [];
    download(withExample ? 'processiq-import-example.csv' : 'processiq-import-template.csv', toCSV(IMPORT_COLUMNS, rows), 'text/csv;charset=utf-8');
  }

  async function backup() {
    if (!(await download(`adoption-tracker-backup-${stamp()}.json`, JSON.stringify(db, null, 2), 'application/json'))) return;
    db.meta.lastBackupAt = new Date().toISOString();
    persist(db);
    render();
    toast('Backup downloaded. Keep the file somewhere safe.');
  }

  function restore(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = normalize(JSON.parse(String(reader.result)));
        const msg = `Restore "${file.name}"?\n\nIt contains ${plural(data.rollouts.length, 'rollout')}, ${plural(data.behaviors.length, 'behavior')} and ${plural(data.checkins.length, 'check-in')}.\n\nThis replaces everything currently in the tracker.`;
        askConfirm(msg, () => {
          db = data;
          ui.reviewDraft = null;
          ui.rolloutFilter = 'all';
          commit('Backup restored.');
        }, 'Replace and restore');
        render();
      } catch (e) {
        toast(`Could not restore: ${e.message || 'the file is not valid.'}`, 'error');
        render();
      }
    };
    reader.readAsText(file);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /* ------------------------------------------------------------------------
     10. Buttons and inputs
     ------------------------------------------------------------------------ */
  const actions = {
    skip: () => main.focus(),
    'close-modal': closeModal,
    'new-rollout': () => rolloutForm(null),
    'edit-rollout': (d) => rolloutForm(rolloutById(d.r)),
    'delete-rollout': (d) => {
      const r = rolloutById(d.r);
      if (!r) return;
      const bIds = db.behaviors.filter((b) => b.rolloutId === r.id).map((b) => b.id);
      askConfirm(`Delete "${r.tool}"?\n\nThis also deletes its ${plural(bIds.length, 'behavior')}, their check-ins, barriers and reviews. This cannot be undone unless you have a backup.`, () => {
      db.rollouts = db.rollouts.filter((x) => x.id !== r.id);
      db.behaviors = db.behaviors.filter((b) => b.rolloutId !== r.id);
      db.checkins = db.checkins.filter((c) => !bIds.includes(c.behaviorId));
      db.barriers = db.barriers.filter((x) => x.rolloutId !== r.id);
      db.reviews = db.reviews.filter((x) => x.rolloutId !== r.id);
      db.imports.forEach((x) => { if (bIds.includes(x.behaviorId)) { x.status = 'pending'; delete x.behaviorId; } });
      location.hash = '#rollouts';
      commit('Rollout deleted.');
      }, 'Delete rollout');
    },
    'new-behavior': (d) => {
      if (!db.rollouts.length) { rolloutForm(null); return; }
      behaviorForm(null, { rolloutId: d.r });
    },
    'edit-behavior': (d) => behaviorForm(behaviorById(d.b)),
    'delete-behavior': (d) => {
      const b = behaviorById(d.b);
      if (!b) return;
      askConfirm(`Delete this behavior and its check-ins and barriers?\n\n"${b.description}"`, () => {
      db.behaviors = db.behaviors.filter((x) => x.id !== b.id);
      db.checkins = db.checkins.filter((c) => c.behaviorId !== b.id);
      db.barriers = db.barriers.filter((x) => x.behaviorId !== b.id);
      db.imports.forEach((x) => { if (x.behaviorId === b.id) { x.status = 'pending'; delete x.behaviorId; } });
      commit('Behavior deleted.');
      }, 'Delete behavior');
    },
    checkin: (d) => checkinForm(d.b, d.d),
    'delete-checkin': (d) => {
      askConfirm('Delete this check-in? The week will show as missing.', () => {
        db.checkins = db.checkins.filter((c) => c.id !== d.id);
        commit('Check-in deleted.');
      }, 'Delete check-in');
    },
    'new-barrier': (d) => {
      if (!db.behaviors.length) { toast('Add a behavior first.', 'error'); return; }
      barrierForm(null, { behaviorId: d.b, rolloutId: d.r });
    },
    'edit-barrier': (d) => barrierForm(db.barriers.find((x) => x.id === d.id)),
    'resolve-barrier': (d) => resolveForm(db.barriers.find((x) => x.id === d.id)),
    'reopen-barrier': (d) => {
      const x = db.barriers.find((y) => y.id === d.id);
      if (!x) return;
      x.status = 'open';
      x.resolvedDate = '';
      commit('Barrier reopened.');
    },
    'delete-barrier': (d) => {
      askConfirm('Delete this barrier?', () => {
        db.barriers = db.barriers.filter((x) => x.id !== d.id);
        commit('Barrier deleted.');
      }, 'Delete barrier');
    },
    'barrier-filter': (d) => { ui.barrierFilter = d.v; render(); },
    'review-step': (d) => {
      if (!ui.reviewDraft) return;
      ui.reviewDraft.step = Number(d.step);
      render();
      main.scrollIntoView({ block: 'start' });
      window.scrollTo(0, 0);
    },
    'save-review': saveReview,
    'view-review': (d) => showReview(d.id),
    'delete-review': (d) => {
      askConfirm('Delete this review record? Barrier changes made by the review stay as they are.', () => {
        db.reviews = db.reviews.filter((x) => x.id !== d.id);
        commit('Review deleted.');
      }, 'Delete review');
    },
    'download-template': () => downloadTemplate(false),
    'download-template-example': () => downloadTemplate(true),
    'import-cancel': () => { ui.importPreview = null; render(); },
    'import-confirm': () => {
      const pv = ui.importPreview;
      if (!pv) return;
      const now = new Date().toISOString();
      const ok = pv.rows.filter((x) => x.ok);
      ok.forEach((x) => db.imports.push({ id: uid(), ...x.data, status: 'pending', importedAt: now }));
      ui.importPreview = null;
      commit(`${plural(ok.length, 'opportunity', 'opportunities')} added to the queue.`);
    },
    'accept-import': (d) => {
      const x = db.imports.find((y) => y.id === d.id);
      if (!x) return;
      behaviorForm(null, {
        importId: x.id, sourceId: x.opportunity_id, description: x.proposed_behavior, owner: x.suggested_owner,
        outcome: x.expected_outcome, measure: x.outcome_measure, baseline: x.baseline, target: x.target, unit: x.unit,
      });
    },
    'dismiss-import': (d) => {
      const x = db.imports.find((y) => y.id === d.id);
      if (x) { x.status = 'dismissed'; commit('Opportunity dismissed. You can restore it from History.'); }
    },
    'restore-import': (d) => {
      const x = db.imports.find((y) => y.id === d.id);
      if (x) { x.status = 'pending'; commit('Opportunity restored to the queue.'); }
    },
    backup,
    'export-behaviors': (d) => exportBehaviors(d.id),
    'export-checkins': exportCheckins,
    'export-barriers': exportBarriers,
    'export-reviews': exportReviews,
    print: () => window.print(),
    'copy-summary': async (d) => {
      const ok = await copyText(summaryText(d.id));
      toast(ok ? 'Summary copied. Paste it into an email or document.' : 'Could not copy automatically. Use Print / Save as PDF instead.', ok ? '' : 'error');
    },
    'load-sample': () => {
      const go = () => {
        db = buildSampleData();
        ui.reviewDraft = null;
        ui.rolloutFilter = 'all';
        location.hash = '#dashboard';
        commit('Example data loaded.');
      };
      if (db.rollouts.length) askConfirm('Replace everything with the fictional example data?\n\nDownload a backup first if you want to keep your current data.', go, 'Replace with example data');
      else go();
    },
    'start-fresh': () => {
      const msg = db.meta.sample
        ? 'Remove the example data and start with a blank tracker?'
        : 'Erase ALL your data and start blank?\n\nThis cannot be undone unless you have a backup file.';
      askConfirm(msg, () => {
      const last = db.meta.lastBackupAt;
      db = emptyDb();
      db.meta.lastBackupAt = last;
      ui.reviewDraft = null;
      ui.rolloutFilter = 'all';
      ui.importPreview = null;
      location.hash = '#dashboard';
      commit('Blank tracker ready. Create your first rollout to begin.');
      }, db.meta.sample ? 'Start blank' : 'Erase everything');
    },
  };

  const changeActions = {
    'filter-rollout': (el) => { ui.rolloutFilter = el.value; render(); },
    'barrier-category': (el) => { ui.barrierCategory = el.value; render(); },
    'import-file': (el) => handleImportFile(el.files && el.files[0]),
    'restore-file': (el) => restore(el.files && el.files[0]),
    'checkin-week': (el) => checkinForm(el.dataset.b, el.value),
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    fn(el.dataset, el);
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.change && changeActions[el.dataset.change]) changeActions[el.dataset.change](el);
    else if (el.dataset && el.dataset.draft) updateDraft(el);
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.draft && el.type !== 'checkbox' && el.type !== 'radio') updateDraft(el);
    if (el.dataset && el.dataset.preview === 'weeks') {
      const form = el.form;
      const p = $('#week-preview');
      if (form && p) p.textContent = weekPreview(form.elements.firstCheckin.value, form.elements.weeks.value);
    }
  });

  function updateDraft(el) {
    if (!ui.reviewDraft) return;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    setPath(ui.reviewDraft, el.dataset.draft, v);
  }

  /* ------------------------------------------------------------------------
     11. Page switching and messages
     ------------------------------------------------------------------------ */
  const main = $('#main');
  const VIEWS = {
    dashboard: viewDashboard, rollouts: viewRollouts, rollout: viewRollout, checkins: viewCheckins,
    barriers: viewBarriers, review: viewReview, import: viewImport, data: viewData, summary: viewSummary, guide: viewGuide,
  };
  const NAV_FOR = { rollout: 'rollouts', summary: 'review' };

  function parseRoute() {
    // Addresses look like #dashboard or #rollout-<id>. Older #/rollout/<id> links still work.
    const h = location.hash.replace(/^#\/?/, '').replace('/', '-');
    const i = h.indexOf('-');
    const view = i === -1 ? h : h.slice(0, i);
    const id = i === -1 ? '' : h.slice(i + 1);
    return { view: VIEWS[view] ? view : 'dashboard', id: decodeURIComponent(id) };
  }

  function render() {
    if (ui.rolloutFilter !== 'all' && !rolloutById(ui.rolloutFilter)) ui.rolloutFilter = 'all';
    const { view, id } = parseRoute();
    const key = `${view}/${id}`;
    main.innerHTML = VIEWS[view](id);
    const nav = NAV_FOR[view] || view;
    document.querySelectorAll('#nav a').forEach((a) => {
      const on = a.dataset.nav === nav;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const titles = { dashboard: 'Dashboard', rollouts: 'Rollouts', rollout: 'Rollout', checkins: 'Check-ins', barriers: 'Barriers', review: 'Manager review', import: 'Import', data: 'Data', summary: 'Summary', guide: 'Guide' };
    document.title = view === 'dashboard' ? 'AI Adoption Follow-Through Tracker' : `${titles[view]} · AI Adoption Follow-Through Tracker`;
    if (key !== ui.lastRoute) {
      window.scrollTo(0, 0);
      const active = $('#nav a.active');
      if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      ui.lastRoute = key;
    }
  }

  let toastTimer;
  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show ${kind ? `toast-${kind}` : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, kind === 'error' ? 6000 : 3500);
  }

  window.addEventListener('hashchange', () => { closeModal(); render(); });
  window.addEventListener('storage', (e) => {
    // Another tab changed the data. Reload it so both tabs stay in step.
    if (e.key === STORE_KEY && e.newValue) {
      try { db = normalize(JSON.parse(e.newValue)); render(); } catch (_) { /* ignore */ }
    }
  });

  db = loadDb();
  render();
}());
