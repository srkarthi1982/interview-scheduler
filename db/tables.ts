import { NOW, column, defineTable } from "astro:db";

export const Interviews = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    title: column.text(),
    candidateName: column.text(),
    candidateEmail: column.text({ optional: true }),
    roleTitle: column.text(),
    companyName: column.text({ optional: true }),
    interviewStage: column.text(),
    meetingDate: column.text(),
    durationMinutes: column.number(),
    notes: column.text({ optional: true }),
    status: column.text({ default: "draft" }),
    selectedSuggestionId: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: [
    { name: "interviews_user_idx", on: "userId" },
    { name: "interviews_user_status_idx", on: ["userId", "status"] },
    { name: "interviews_user_meeting_date_idx", on: ["userId", "meetingDate"] },
  ],
});

export const InterviewParticipants = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    interviewId: column.text(),
    name: column.text(),
    email: column.text({ optional: true }),
    participantType: column.text(),
    timezone: column.text(),
    availabilityStartLocal: column.text(),
    availabilityEndLocal: column.text(),
    preferredStartLocal: column.text({ optional: true }),
    preferredEndLocal: column.text({ optional: true }),
    isRequired: column.boolean({ default: true }),
    sortOrder: column.number({ default: 0 }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: [
    { name: "interview_participants_interview_idx", on: "interviewId" },
    { name: "interview_participants_interview_sort_idx", on: ["interviewId", "sortOrder"] },
  ],
});

export const InterviewSuggestions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    interviewId: column.text(),
    startUtc: column.date(),
    endUtc: column.date(),
    participantCoverage: column.number(),
    requiredCoverage: column.number(),
    score: column.number(),
    label: column.text(),
    explanation: column.text({ optional: true }),
    isSelected: column.boolean({ default: false }),
    coveredParticipantIds: column.text({ optional: true }),
    preferredParticipantIds: column.text({ optional: true }),
    participantsJson: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
  indexes: [
    { name: "interview_suggestions_interview_idx", on: "interviewId" },
    { name: "interview_suggestions_interview_selected_idx", on: ["interviewId", "isSelected"] },
    { name: "interview_suggestions_interview_score_idx", on: ["interviewId", "score"] },
  ],
});

export const starterTables = {
  Interviews,
  InterviewParticipants,
  InterviewSuggestions,
} as const;
