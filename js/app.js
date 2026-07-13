/* =========================================================================
   APP.js - state machine driving the study.
   Screens: welcome -> consent -> demographics -> [context video ->
   (trial video + survey together) x N] for each setting -> complete
   ========================================================================= */

const root = document.getElementById('app');

let state = freshState();

function freshState() {
  return {
    participantId: 'P-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    startedAt: new Date().toISOString(),
    screen: 'welcome',
    demographics: null,
    sequence: null,          // built after demographics
    cursor: 0,               // index into sequence - the participant's real forward position
    reviewingStepIndex: null, // if set, temporarily viewing/editing an earlier trial
    responses: [],            // one entry per completed trial
    totalItemsAll: 0          // total questionnaire items across the whole sequence, for progress %
  };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds the fully counterbalanced sequence for one participant: random
// setting order, and within each setting, an independently randomized
// order for Study 1's three conditions and Study 2's two.
function buildSequence() {
  const settingOrder = shuffle(SETTINGS);
  const seq = [];
  settingOrder.forEach(setting => {
    seq.push({ type: 'context', setting });
    shuffle(STUDY1_CONDITIONS).forEach(cond => {
      seq.push({ type: 'trial', study: 1, setting, condition: cond });
    });
    shuffle(STUDY2_CONDITIONS).forEach(cond => {
      seq.push({ type: 'trial', study: 2, setting, condition: cond });
    });
  });
  return seq;
}

function totalTrials() {
  return state.sequence ? state.sequence.filter(s => s.type === 'trial').length : 0;
}
function trialNumberAt(index) {
  if (!state.sequence) return 0;
  return state.sequence.slice(0, index + 1).filter(s => s.type === 'trial').length;
}
function findPreviousTrialIndex(fromIndex) {
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (state.sequence[i].type === 'trial') return i;
  }
  return null;
}
function computeTotalItemsAll() {
  return state.sequence
    .filter(s => s.type === 'trial')
    .reduce((sum, s) => sum + itemIdsForStudy(s.study).length, 0);
}

/* ---------------------------- render router ---------------------------- */

function render() {
  root.innerHTML = '';
  if (state.screen === 'welcome') return renderWelcome();
  if (state.screen === 'consent') return renderConsent();
  if (state.screen === 'demographics') return renderDemographics();
  if (state.screen === 'sequence') return renderSequenceStep();
  if (state.screen === 'submitting') return renderSubmitting();
  if (state.screen === 'complete') return renderComplete();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

/* ------------------------------- screens -------------------------------- */

function renderWelcome() {
  root.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'eyebrow' }, 'HRI Trust Study'),
    el('h1', {}, CONFIG.STUDY_TITLE),
    el('p', { class: 'body-text' }, CONFIG.STUDY_INTRO),
    el('div', { class: 'row gap' }, [
      el('button', { class: 'btn primary', onclick: () => { state.screen = 'consent'; render(); } }, 'Begin')
    ])
  ]));
}

function renderConsent() {
  root.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'eyebrow' }, 'Step 1 of 3 - Consent'),
    el('h2', {}, 'Participant Consent'),
    el('p', { class: 'body-text' }, CONFIG.CONSENT_TEXT),
    el('div', { class: 'row gap' }, [
      el('button', { class: 'btn primary', onclick: () => { state.screen = 'demographics'; render(); } }, 'I agree, continue')
    ])
  ]));
}

function renderDemographics() {
  const values = state.demographics || {};
  const fields = DEMOGRAPHIC_FIELDS.map(f => {
    let input;
    if (f.type === 'select') {
      input = el('select', { id: f.id, class: 'input' }, [
        el('option', { value: '' }, 'Select...'),
        ...f.options.map(o => {
          const opt = el('option', { value: o }, o);
          if (values[f.id] === o) opt.setAttribute('selected', 'selected');
          return opt;
        })
      ]);
    } else {
      input = el('input', { id: f.id, class: 'input', type: f.type, min: f.min, max: f.max });
      if (values[f.id]) input.value = values[f.id];
    }
    return el('label', { class: 'field' }, [el('span', {}, f.label), input]);
  });

  const errorBox = el('p', { class: 'error hidden' }, 'Please complete all fields before continuing.');

  root.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'eyebrow' }, 'Step 2 of 3 - About you'),
    el('h2', {}, 'Demographic Survey'),
    el('div', { class: 'form-grid' }, fields),
    errorBox,
    el('div', { class: 'row gap' }, [
      el('button', { class: 'btn primary', onclick: () => {
        const data = {};
        let ok = true;
        DEMOGRAPHIC_FIELDS.forEach(f => {
          const v = document.getElementById(f.id).value;
          if (f.required && !v) ok = false;
          data[f.id] = v;
        });
        if (!ok) { errorBox.classList.remove('hidden'); return; }
        state.demographics = data;
        state.sequence = buildSequence();
        state.totalItemsAll = computeTotalItemsAll();
        state.cursor = 0;
        state.reviewingStepIndex = null;
        state.screen = 'sequence';
        render();
      }}, 'Continue')
    ])
  ]));
}

function renderSequenceStep() {
  const displayIndex = state.reviewingStepIndex !== null ? state.reviewingStepIndex : state.cursor;
  const step = state.sequence[displayIndex];
  if (!step) { state.screen = 'submitting'; return render(); }
  if (step.type === 'context') return renderContextScreen(step, displayIndex);
  return renderTrialScreen(step, displayIndex);
}

/* ------------------------- progress bar (shared) ------------------------ */

function answeredCountSoFar(extra) {
  const fromResponses = state.responses.reduce((sum, r) => sum + Object.keys(r.answers).length, 0);
  return fromResponses + (extra || 0);
}
function buildProgressBar() {
  const label = el('p', { class: 'hint progress-label' }, '');
  const track = el('div', { class: 'progress-track' });
  const fill = el('div', { class: 'progress-fill' });
  track.appendChild(fill);
  function update(liveExtra) {
    const answered = answeredCountSoFar(liveExtra);
    const pct = state.totalItemsAll ? Math.min(100, Math.round((answered / state.totalItemsAll) * 100)) : 0;
    fill.style.width = pct + '%';
    label.textContent = `Overall progress: ${pct}%`;
  }
  update(0);
  return { wrap: el('div', { class: 'progress-wrap' }, [label, track]), update };
}

/* ------------------------------ context step ----------------------------- */

function renderContextScreen(step, displayIndex) {
  const progress = buildProgressBar();
  const continueBtn = el('button', { class: 'btn primary' }, 'Continue');
  const videoHint = el('p', { class: 'error hidden' }, 'Please check the box below once you have watched the video.');
  const checkbox = el('input', { type: 'checkbox', id: 'watched_context' });
  checkbox.addEventListener('change', () => { if (checkbox.checked) videoHint.classList.add('hidden'); });

  const iframe = el('iframe', { class: 'study-video', src: contextVideoPath(step.setting.id), allow: 'autoplay', frameborder: '0' });

  continueBtn.addEventListener('click', () => {
    if (!checkbox.checked) { videoHint.classList.remove('hidden'); return; }
    state.cursor = displayIndex + 1;
    render();
  });

  root.appendChild(el('div', { class: 'card stack' }, [
    progress.wrap,
    el('p', { class: 'eyebrow mono' }, 'Introduction'),
    el('p', { class: 'body-text' }, 'Please watch the following scenario.'),
    iframe,
    el('label', { class: 'checkbox-row' }, [checkbox, el('span', {}, 'I have watched this video.')]),
    videoHint,
    el('div', { class: 'row gap' }, [continueBtn])
  ]));
}

/* -------------------------- trial (video + survey) ------------------------ */

function renderTrialScreen(step, displayIndex) {
  const isReviewing = state.reviewingStepIndex !== null;
  const trialNum = trialNumberAt(displayIndex);
  const existing = state.responses.find(r => r.trial_index === trialNum);
  const answers = existing ? { ...existing.answers } : {};
  let hasWatchedVideo = !!existing; // if we've completed this trial before, treat as already watched

  const progress = buildProgressBar();

  // --- condition video ---
  const videoHint = el('p', { class: 'error hidden' }, 'Please check the box below once you have watched the video.');
  const watchedCheckbox = el('input', { type: 'checkbox', id: 'watched_trial_' + displayIndex });
  if (hasWatchedVideo) watchedCheckbox.checked = true;
  watchedCheckbox.addEventListener('change', () => { hasWatchedVideo = watchedCheckbox.checked; if (hasWatchedVideo) videoHint.classList.add('hidden'); });
  const iframe = el('iframe', { class: 'study-video', src: trialVideoPath(step.study, step.setting.id, step.condition.id), allow: 'autoplay', frameborder: '0' });

  // --- rewatch context video toggle ---
  const contextIframe = el('iframe', { class: 'study-video hidden', src: contextVideoPath(step.setting.id), allow: 'autoplay', frameborder: '0' });
  const toggleBtn = el('button', { class: 'btn ghost small' }, 'Rewatch introduction video');
  toggleBtn.addEventListener('click', () => {
    contextIframe.classList.toggle('hidden');
    toggleBtn.textContent = contextIframe.classList.contains('hidden') ? 'Rewatch introduction video' : 'Hide introduction video';
  });

  // --- survey sections (filtered by study) ---
  const rowRefs = {}; // item_id -> row element, for invalid highlighting
  const sections = sectionsForStudy(step.study).map(section => {
    const rows = section.items.map(item => {
      const rowId = `q_${item.id}_${displayIndex}`;
      const radios = [1, 2, 3, 4, 5, 6, 7].map(v => {
        const input = el('input', { type: 'radio', name: rowId, value: v });
        if (answers[item.id] === v) input.checked = true;
        input.addEventListener('change', () => {
          answers[item.id] = v;
          row.classList.remove('invalid');
          progress.update(Object.keys(answers).length);
        });
        return el('label', { class: 'likert-opt' }, [input, el('span', {}, String(v))]);
      });
      const row = el('div', { class: 'likert-row' }, [
        el('p', { class: 'likert-text' }, item.text),
        el('div', { class: 'likert-scale' }, radios)
      ]);
      rowRefs[item.id] = row;
      return row;
    });
    return el('div', { class: 'section-block' }, [
      el('h3', {}, section.title),
      el('div', { class: 'likert-anchors' }, [el('span', {}, 'Strongly Disagree'), el('span', {}, 'Strongly Agree')]),
      ...rows
    ]);
  });

  const allItemIds = itemIdsForStudy(step.study);
  progress.update(Object.keys(answers).length);

  const surveyErrorBox = el('p', { class: 'error hidden' }, 'Please answer the highlighted questions above.');

  const backBtn = (() => {
    const prevIndex = findPreviousTrialIndex(displayIndex);
    if (prevIndex === null) return null;
    const b = el('button', { class: 'btn ghost' }, 'Back');
    b.addEventListener('click', () => { state.reviewingStepIndex = prevIndex; render(); });
    return b;
  })();

  const primaryBtn = el('button', { class: 'btn primary' }, isReviewing ? 'Save & Return' : 'Submit & Continue');
  primaryBtn.addEventListener('click', () => {
    let ok = true;
    if (!hasWatchedVideo) { videoHint.classList.remove('hidden'); ok = false; }
    const missing = allItemIds.filter(id => answers[id] === undefined);
    missing.forEach(id => rowRefs[id].classList.add('invalid'));
    if (missing.length) { surveyErrorBox.classList.remove('hidden'); ok = false; } else { surveyErrorBox.classList.add('hidden'); }
    if (!ok) { window.scrollTo(0, 0); return; }

    const responseObj = {
      trial_index: trialNum,
      study: step.study,
      setting_id: step.setting.id,
      condition_id: step.condition.id, // internal, never shown to participant
      completed_at: new Date().toISOString(),
      answers
    };
    const idx = state.responses.findIndex(r => r.trial_index === trialNum);
    if (idx >= 0) state.responses[idx] = responseObj; else state.responses.push(responseObj);

    if (isReviewing) { state.reviewingStepIndex = null; }
    else { state.cursor = displayIndex + 1; }
    render();
  });

  root.appendChild(el('div', { class: 'card stack' }, [
    progress.wrap,
    el('p', { class: 'eyebrow mono' }, `Scenario ${trialNum} of ${totalTrials()}${isReviewing ? ' - reviewing' : ''}`),
    el('p', { class: 'body-text' }, 'Please watch the robot in this clip.'),
    iframe,
    el('label', { class: 'checkbox-row' }, [watchedCheckbox, el('span', {}, 'I have watched this video.')]),
    videoHint,
    toggleBtn,
    el('p', { class: 'hint' }, 'You can rewatch the introduction video for this scenario at any time before submitting.'),
    contextIframe,
    ...sections,
    surveyErrorBox,
    el('div', { class: 'row gap' }, [backBtn, primaryBtn].filter(Boolean))
  ]));
}

/* -------------------------------- complete -------------------------------- */

function renderSubmitting() {
  if (!state.finalPayload) {
    state.finalPayload = {
      participant_id: state.participantId,
      started_at: state.startedAt,
      finished_at: new Date().toISOString(),
      demographics: state.demographics,
      trials: state.responses
    };
    state.submitStatusText = CONFIG.SUBMIT_URL
      ? 'Submitting your data...'
      : 'No server configured - please download your data below and send it to the research team.';

    if (CONFIG.SUBMIT_URL) {
      fetch(CONFIG.SUBMIT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(state.finalPayload)
      }).then(() => { state.submitStatusText = 'Data submitted. Thank you.'; })
        .catch(() => { state.submitStatusText = 'Could not reach the server - please use the download buttons below as a backup.'; });
    }

    setTimeout(() => { state.screen = 'complete'; render(); }, 4000);
  }

  root.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'eyebrow' }, 'Please wait'),
    el('h2', {}, 'Submitting your responses...'),
    el('p', { class: 'body-text' }, 'This will only take a moment.')
  ]));
}

function renderComplete() {
  const payload = state.finalPayload;

  root.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'eyebrow' }, 'Done'),
    el('h2', {}, 'Thank you for participating'),
    el('p', { class: 'body-text' }, 'Your responses have been recorded. You may now close this window.'),
    el('p', { class: 'body-text' }, 'This data will only be used for academic research purposes.'),
    el('p', { class: 'body-text' }, 'If you have any questions, please contact Christine Suen at ws2765@columbia.edu.'),
    el('p', { class: 'hint' }, state.submitStatusText),
    el('div', { class: 'row gap' }, [
      el('button', { class: 'btn ghost', onclick: () => downloadJSON(payload) }, 'Download JSON'),
      el('button', { class: 'btn ghost', onclick: () => downloadCSV(payload) }, 'Download CSV')
    ])
  ]));
}

/* ------------------------------- exports -------------------------------- */

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(payload) {
  downloadBlob(`${payload.participant_id}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

// Long-format CSV: one row per participant x trial x item.
function downloadCSV(payload) {
  const allItems = QUESTION_SECTIONS.flatMap(s => s.items.map(i => ({ ...i, section: s.id })));
  const demoKeys = Object.keys(payload.demographics || {});
  const header = [
    'participant_id', 'trial_index', 'study', 'setting_id', 'condition_id',
    'section', 'item_id', 'item_text', 'raw_value', 'reverse_scored', 'recoded_value',
    ...demoKeys.map(k => `demo_${k}`)
  ];
  const rows = [header.join(',')];
  payload.trials.forEach(trial => {
    allItems.forEach(item => {
      const raw = trial.answers[item.id];
      if (raw === undefined) return; // item wasn't part of this trial's study
      const recoded = item.reverse ? (8 - raw) : raw;
      const row = [
        payload.participant_id, trial.trial_index, trial.study, trial.setting_id, trial.condition_id,
        item.section, item.id, csvEscape(item.text), raw, !!item.reverse, recoded,
        ...demoKeys.map(k => csvEscape(payload.demographics[k]))
      ];
      rows.push(row.join(','));
    });
  });
  downloadBlob(`${payload.participant_id}.csv`, rows.join('\n'), 'text/csv');
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

render();
