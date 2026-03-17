export type InterviewStatus = "draft" | "generated" | "scheduled" | "archived";
export type SuggestionLabel = "best" | "good" | "partial";
export type ParticipantType = "candidate" | "interviewer" | "observer";

export type InterviewDTO = {
  id: string;
  title: string;
  candidateName: string;
  candidateEmail: string | null;
  roleTitle: string;
  companyName: string | null;
  interviewStage: string;
  meetingDate: string;
  durationMinutes: number;
  notes: string;
  status: InterviewStatus;
  selectedSuggestionId: string | null;
  participantCount: number;
  suggestionCount: number;
  selectedSuggestionLabel: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ParticipantDTO = {
  id: string;
  interviewId: string;
  name: string;
  email: string | null;
  participantType: ParticipantType;
  timezone: string;
  availabilityStartLocal: string;
  availabilityEndLocal: string;
  preferredStartLocal: string | null;
  preferredEndLocal: string | null;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SuggestionLocalTimeDTO = {
  participantId: string;
  participantName: string;
  participantType: ParticipantType;
  timezone: string;
  timeLabel: string;
  covered: boolean;
  preferred: boolean;
};

export type SuggestionDTO = {
  id: string;
  interviewId: string;
  startUtc: string;
  endUtc: string;
  participantCoverage: number;
  requiredCoverage: number;
  score: number;
  label: SuggestionLabel;
  explanation: string | null;
  isSelected: boolean;
  timeRangeLabelUtc: string;
  localTimes: SuggestionLocalTimeDTO[];
};

export type InterviewDetailDTO = {
  interview: InterviewDTO;
  participants: ParticipantDTO[];
  suggestions: SuggestionDTO[];
  totalParticipants: number;
  requiredParticipants: number;
  lastGeneratedAt: string | null;
  selectedSuggestion: SuggestionDTO | null;
};
