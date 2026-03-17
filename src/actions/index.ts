import {
  addParticipant,
  archiveInterview,
  chooseSuggestion,
  createInterview,
  deleteInterview,
  deleteParticipant,
  generateSuggestions,
  getInterviewDetail,
  listInterviews,
  updateInterview,
  updateParticipant,
} from "./interviewScheduler";

export const interviewScheduler = {
  listInterviews,
  getInterviewDetail,
  createInterview,
  updateInterview,
  archiveInterview,
  deleteInterview,
  addParticipant,
  updateParticipant,
  deleteParticipant,
  generateSuggestions,
  chooseSuggestion,
};

export const server = {
  interviewScheduler,
};
