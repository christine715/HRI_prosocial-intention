/* =========================================================================
   CONFIG.js
   Everything a researcher needs to edit lives in this file:
   video paths, condition labels, and the questionnaire items.
   App logic (js/app.js) should not need to change when you edit this.
   ========================================================================= */

const CONFIG = {
  // Paste a Google Apps Script Web App URL here to auto-submit each
  // participant's data to a Google Sheet. Leave as '' to skip network
  // submission and rely on the in-browser JSON/CSV download only.
  // See README.md > "Collecting data centrally" for setup steps.
  SUBMIT_URL: '',

  // Shown on the welcome screen. Edit freely.
  STUDY_TITLE: 'Robot Assistance Study',
  STUDY_INTRO: `You will watch a series of short video clips showing a robot
    helping a person, then answer a few questions about each clip.
    There are no right or wrong answers — please respond based on your
    honest impressions.`,

  CONSENT_TEXT: `By clicking "I agree" you confirm that you are 18 years of
    age or older, that you have read the participant information, and that
    you voluntarily agree to take part in this study. Your responses are
    confidential and will be used for research purposes only. You may
    withdraw at any time by closing this window.`
};

/* -------------------------------------------------------------------------
   HRI SETTINGS (counterbalanced order)
   context: the ~40s scenario-establishing video, shown once per setting
   ---------------------------------------------------------------------- */
const SETTINGS = [
  { id: 'social_care', label: 'Social-care scenario', context: 'videos/context_social_care.mp4' },
  { id: 'industrial',  label: 'Industrial scenario',  context: 'videos/context_industrial.mp4' }
];

/* -------------------------------------------------------------------------
   STUDY 1 conditions — motivational autonomy (preprogrammed / cost-benefit /
   empathy-driven). Internal ids are recorded in the data but NEVER shown
   to participants, to avoid tipping them off to the manipulation.
   ---------------------------------------------------------------------- */
const STUDY1_CONDITIONS = [
  { id: 'preprogrammed', file: 'preprogrammed' },
  { id: 'costbenefit',   file: 'costbenefit' },
  { id: 'empathy',       file: 'empathy' }
];

/* -------------------------------------------------------------------------
   STUDY 2 conditions — motivational orientation (altruistic / egoistic).
   ---------------------------------------------------------------------- */
const STUDY2_CONDITIONS = [
  { id: 'altruistic', file: 'altruistic' },
  { id: 'egoistic',   file: 'egoistic' }
];

// Builds the expected video file path for a given trial.
// Study 1: videos/s1_<setting>_<condition>.mp4
// Study 2: videos/s2_<setting>_<condition>.mp4
function trialVideoPath(study, settingId, conditionFile) {
  return `videos/s${study}_${settingId}_${conditionFile}.mp4`;
}

/* -------------------------------------------------------------------------
   DEMOGRAPHICS FORM
   ---------------------------------------------------------------------- */
const DEMOGRAPHIC_FIELDS = [
  { id: 'age', label: 'Age', type: 'number', min: 18, max: 100, required: true },
  {
    id: 'gender', label: 'Gender', type: 'select', required: true,
    options: ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other']
  },
  {
    id: 'education', label: "Highest level of education completed", type: 'select', required: true,
    options: ['High school or equivalent', 'Some college', "Bachelor's degree", 'Graduate degree', 'Other']
  },
  {
    id: 'robot_experience', label: 'Prior experience with robots', type: 'select', required: true,
    options: ['None', 'Very little', 'Some', 'A lot']
  },
  {
    id: 'robot_frequency', label: 'How often do you interact with robots?', type: 'select', required: true,
    options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often']
  }
];

/* -------------------------------------------------------------------------
   QUESTIONNAIRE — shown in full after every trial video.
   Scale is fixed 1–7 (Strongly Disagree → Strongly Agree).
   `reverse: true` items are reverse-scored during CSV export
   (recoded value = 8 - raw value) but raw values are also kept.
   ---------------------------------------------------------------------- */
const QUESTION_SECTIONS = [
  {
    id: 'trust_interaction',
    title: 'Trust & Continued Interaction',
    items: [
      { id: 'ti1', text: 'I would be willing to accept help from this robot.' },
      { id: 'ti2', text: "I would feel comfortable relying on this robot's assistance." },
      { id: 'ti3', text: 'I would trust this robot to help me in the future.' },
      { id: 'ci1', text: 'It is likely that the robot and I could become friends if we interacted a lot.' },
      { id: 'ci2', text: "I'd really prefer not to interact with the robot in the future.", reverse: true },
      { id: 'ci3', text: 'I feel close to the robot.' }
    ]
  },
  {
    id: 'abi',
    title: 'Ability & Benevolence',
    items: [
      { id: 'ab1', text: 'The robot is very capable of performing its job.' },
      { id: 'ab2', text: 'The robot is known to be successful at the things it tries to do.' },
      { id: 'ab3', text: 'The robot has much knowledge about the work that needs to be done.' },
      { id: 'ab4', text: "I feel very confident about the robot's skills." },
      { id: 'ab5', text: 'The robot has specialized capabilities that can benefit us.' },
      { id: 'ab6', text: 'The robot is well qualified for its role.' },
      { id: 'bv1', text: 'The robot is very concerned about my welfare.' },
      { id: 'bv2', text: 'My needs and desires are very important to the robot.' },
      { id: 'bv3', text: 'The robot would not knowingly do anything to hurt me.' },
      { id: 'bv4', text: 'The robot really looks out for what is important to me.' },
      { id: 'bv5', text: "The robot is very concerned about others' welfare." }
    ]
  },
  {
    id: 'motivation',
    title: 'Perceived Motivation for Helping',
    items: [
      { id: 'm1', text: 'The robot helped because it cared about the person.' },
      { id: 'm2', text: 'The robot helped because it valued acting this way.' },
      { id: 'm3', text: 'The robot helped because it thought it was important to act this way.' },
      { id: 'm4', text: 'The robot helped because it liked acting this way.' },
      { id: 'm5', text: 'The robot helped because it appreciated that its help could be useful.' },
      { id: 'm6', text: 'The robot helped so that it would be liked.' },
      { id: 'm7', text: 'The robot helped because it felt it had to.' },
      { id: 'm8', text: 'The robot helped because it felt it should.' },
      { id: 'm9', text: "The robot helped because others would be upset if it didn't." }
    ]
  },
  {
    id: 'altruism_egoism',
    title: 'Perceived Altruism & Egoism',
    items: [
      { id: 'al1', text: "The robot's help seemed genuinely focused on benefiting the other person." },
      { id: 'al2', text: "This robot appeared to act in the person's interest, not its own." },
      { id: 'al3', text: 'The robot seemed to give help freely, without expecting anything in return.' },
      { id: 'al4', text: 'This robot appeared to notice and respond to what the person actually needed.' },
      { id: 'eg1', text: "The robot's help seemed primarily designed to serve its own objectives." },
      { id: 'eg2', text: 'This robot appeared to treat the person as a means to its own ends.' },
      { id: 'eg3', text: 'The robot seemed indifferent to whether its help was actually good for the person.' },
      { id: 'eg4', text: 'This robot would likely stop helping if it no longer benefited from doing so.' },
      { id: 'eg5', text: "The robot's assistance felt transactional rather than genuinely caring." }
    ]
  }
];
