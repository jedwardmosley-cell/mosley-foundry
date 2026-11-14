/**
 * MY FEEDBACK: the client's own summary of a 360 or an EQ-i debrief. Build-team wording,
 * DRAFT FOR AUTHOR REVIEW. The app never reads, parses or reproduces a vendor report.
 */
export const FEEDBACK_STATUS: "draft" | "approved" = "draft";

export const FEEDBACK_SOURCES = {
  CCL_360: "CCL 360",
  EQI: "EQ-i 2.0",
  OTHER_360: "Another 360",
  OTHER: "Other",
} as const;
export type FeedbackSource = keyof typeof FEEDBACK_SOURCES;

export const FEEDBACK_COPY = {
  intro: "Your own summary of a 360, an EQ-i debrief, or other feedback. Private unless you choose to share it.",
  ownSummary: "This is my own summary or notes, not the full report.",
  fileHint: "PDF, Word or a photo of your own notes, up to 4 MB.",
  notFullReport: "Please upload or paste your own summary, your notes, or what you took from your debrief. Not the full report.",
  pillarsQuestion: "Which part of FORGE does it speak to?",
  shareCoach: "Share this with my coach",
  allowAi: "Let the AI companion use my summary",
  aiNote: "The AI companion reads your summary only. It never opens the file.",
  notSameMeasure: "This is your own reading of your feedback. It isn't the same measure as your FORGE scores.",
  publisherNote: "CCL 360 assessments are published by the Center for Creative Leadership, and EQ-i 2.0 by MHS. This app doesn't read, score or interpret those reports. FORGE self-ratings and those assessments measure different things, so one can't stand in for the other.",
};

/** 4 MB: under the hosting limit for one upload. */
export const FEEDBACK_MAX_BYTES = 4 * 1024 * 1024;
export const FEEDBACK_FILE_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "image/jpeg": "Photo",
  "image/png": "Photo",
  "image/heic": "Photo",
  "image/heif": "Photo",
  "image/webp": "Photo",
};
