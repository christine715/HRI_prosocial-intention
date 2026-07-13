/* =========================================================================
   APP.js — state machine driving the study.
   Screens: welcome -> consent -> demographics -> [context video -> (trial
   video -> survey) x N] for each setting -> complete
   ========================================================================= */

const root = document.getElementById('app');

let state = freshState();

function freshState() {
  return {
    participantId: 'P-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    startedAt: new Date().toISOString(),
    screen: 'welcome',
    demographics: null,
    sequence: null,      // built after demographics
    cursor: 0,           // index into sequence
    videoWatched: false, // has the current video reached 'ended' at least once
    responses: []         // one entry per completed trial
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

// Builds the fully counterbalanced sequence for one participant:
// random setting order, and within each setting, an independently
// randomized order for Study 1's three conditions and Study 2's two.
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

/* ---------------------------- render router ---------------------------- */

function render() {
  root.innerHTML = '';
  if (state.screen === 'welcome') return renderWelcome();
  if (state.screen === 'consent') return renderConsent();
  if (state.screen === 'demographics') return renderDemographics();
  if (state.screen === 'sequence') return renderSequenceStep();
  if (state.screen === 'complete') return renderComplete();
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
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
    el('p', { class: 'eyebrow' }, 'Step 1 of 3 — Consent'),
    el('h2', {}, 'Participant Consent'),
    el('p', { class: 'body-text' }, CONFIG.CONSENT_TEXT),
    el('div', { class: 'row gap' }, [
      el('button', { class: 'btn primary', onclick: () => { state.screen = 'demographics'; render(); } }, 'I agree, continue'),
    ])
  ]));
}

function renderDemographics() {
  const values = state.demographics || {};
  const fields = DEMOGRAPHIC_FIELDS.map(f => {
    let input;
    if (f.type === 'select') {
      input = el('select', { id: f.id, class: 'input' }, [
        el('option', { value: '' }, 'Select…'),
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
    el('p', { class: 'eyebrow' }, 'Step 2 of 3 — About you'),
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
        state.cursor = 0;
        state.videoWatched = false;
        state.screen = 'sequence';
        render();
      }}, 'Continue')
    ])
  ]));
}

function renderSequenceStep() {
  const step = state.sequence[state.cursor];
  if (!step) { state.screen = 'complete'; return render(); }
  if (step.type === 'context') return renderVideoScreen({
    video: contextVideoPath(step.setting.id),
    caption: 'Please watch the following scenario.',
    onContinue: () => { state.cursor++; state.videoWatched = false; render(); }
  });
  // trial: show manipulation video, then survey
  if (!state.currentTrialPhase) state.currentTrialPhase = 'video';

  if (state.currentTrialPhase === 'video') {
    const video = trialVideoPath(step.study, step.setting.id, step.condition.id);
    return renderVideoScreen({
      video,
      caption: 'Please watch the robot in this clip.',
      onContinue: () => { state.currentTrialPhase = 'survey'; state.videoWatched = false; render(); }
    });
  }

  return renderSurveyScreen(step);
}

function renderVideoScreen(opts) {
  const trialLabel = totalTrials() ? `Scenario ${trialNumberAt(state.cursor) || trialNumberAt(state.cursor - 1) + 1} of ${totalTrials()}` : '';
  const continueBtn = el('button', { class: 'btn primary', disabled: 'disabled' }, `Continue (${opts.video.seconds}s)`);
  const iframe = el('iframe', {
    class: 'study-video',
    src: `https://drive.google.com/file/d/${opts.video.id}/preview`,
    allow: 'autoplay',
    frameborder: '0'
  });
  continueBtn.addEventListener('click', opts.onContinue);

  root.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'eyebrow mono' }, trialLabel || 'Scenario video'),
    el('p', { class: 'body-text' }, opts.caption),
    iframe,
    el('p', { class: 'hint' }, 'Please press play and watch the full clip. The Continue button unlocks after it has had time to finish.'),
    el('div', { class: 'row gap' }, [continueBtn])
  ]));

  let remaining = opts.video.seconds;
  const timer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timer);
      continueBtn.textContent = 'Continue';
      continueBtn.removeAttribute('disabled');
    } else {
      continueBtn.textContent = `Continue (${remaining}s)`;
    }
  }, 1000);
}

function renderSurveyScreen(step) {
  const trialNum = trialNumberAt(state.cursor);
  const answers = {};

  const sections = QUESTION_SECTIONS.map(section => {
    const rows = section.items.map(item => {
      const rowId = `q_${item.id}`;
      const radios = [1, 2, 3, 4, 5, 6, 7].map(v => {
        const input = el('input', { type: 'radio', name: rowId, value: v, onchange: () => { answers[item.id] = v; } });
        return el('label', { class: 'likert-opt' }, [input, el('span', {}, String(v))]);
      });
      return el('div', { class: 'likert-row' }, [
        el('p', { class: 'likert-text' }, item.text),
        el('div', { class: 'likert-scale' }, radios)
      ]);
    });
    return el('div', { class: 'section-block' }, [
      el('h3', {}, section.title),
      el('div', { class: 'likert-anchors' }, [
        el('span', {}, 'Strongly Disagree'),
        el('span', {}, 'Strongly Agree')
      ]),
      ...rows
    ]);
  });

  const errorBox = el('p', { class: 'error hidden' }, 'Please answer every item before continuing.');
  const allItemIds = QUESTION_SECTIONS.flatMap(s => s.items.map(i => i.id));

  root.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'eyebrow mono' }, `Scenario ${trialNum} of ${totalTrials()} — Questionnaire`),
    ...sections,
    errorBox,
    el('div', { class: 'row gap' }, [
      el('button', { class: 'btn primary', onclick: () => {
        if (allItemIds.some(id => answers[id] === undefined)) { errorBox.classList.remove('hidden'); window.scrollTo(0,0); return; }
        state.responses.push({
          trial_index: trialNum,
          study: step.study,
          setting_id: step.setting.id,
          condition_id: step.condition.id, // internal, never shown to participant
          completed_at: new Date().toISOString(),
          answers
        });
        state.cursor++;
        state.currentTrialPhase = 'video';
        state.videoWatched = false;
        render();
      }}, 'Submit & Continue')
    ])
  ]));
}

function renderComplete() {
  const payload = {
    participant_id: state.participantId,
    started_at: state.startedAt,
    finished_at: new Date().toISOString(),
    demographics: state.demographics,
    trials: state.responses
  };

  let submitStatus = el('p', { class: 'hint' }, '');
  if (CONFIG.SUBMIT_URL) {
    submitStatus.textContent = 'Submitting your data…';
    fetch(CONFIG.SUBMIT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    }).then(() => { submitStatus.textContent = 'Data submitted. Thank you.'; })
      .catch(() => { submitStatus.textContent = 'Could not reach the server — please use the download buttons below as a backup.'; });
  } else {
    submitStatus.textContent = 'No server configured — please download your data below and send it to the research team.';
  }

  root.appendChild(el('div', { class: 'card stack' }, [
    el('p', { class: 'eyebrow' }, 'Done'),
    el('h2', {}, 'Thank you for participating'),
    el('p', { class: 'body-text' }, 'Your responses have been recorded. You may now close this window.'),
    submitStatus,
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
