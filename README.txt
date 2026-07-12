Put your video files in this folder with these exact names.
The app builds these paths automatically from js/config.js — rename your
exports to match, or edit config.js if you'd rather keep your own names.

CONTEXT VIDEOS (one per setting, ~40s, shown once per setting)
  context_social_care.mp4
  context_industrial.mp4

STUDY 1 — motivational autonomy (~15s manipulation clips)
  s1_social_care_preprogrammed.mp4
  s1_social_care_costbenefit.mp4
  s1_social_care_empathy.mp4
  s1_industrial_preprogrammed.mp4
  s1_industrial_costbenefit.mp4
  s1_industrial_empathy.mp4

STUDY 2 — motivational orientation (~20s manipulation clips)
  s2_social_care_altruistic.mp4
  s2_social_care_egoistic.mp4
  s2_industrial_altruistic.mp4
  s2_industrial_egoistic.mp4

Total: 2 context + 6 Study-1 clips + 4 Study-2 clips = 12 files.

Keep file sizes reasonable (compress with e.g. Handbrake, H.264, ~720p) —
GitHub has a 100MB per-file limit and repos get slow/unwieldy above ~1GB.
If your videos are large, consider hosting them elsewhere (e.g. a
Cloudflare R2 / S3 bucket, or Vimeo/YouTube unlisted with a direct file
link) and pointing SETTINGS / trialVideoPath() in js/config.js at those
URLs instead of local files.
