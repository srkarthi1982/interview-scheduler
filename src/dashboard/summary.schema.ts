import { InterviewParticipants, Interviews, InterviewSuggestions, db, eq, inArray } from "astro:db";
import { APP_META } from "../app.meta";

export type InterviewSchedulerDashboardSummaryV1 = {
  appId: typeof APP_META.key;
  version: 1;
  updatedAt: string;
  totalInterviews: number;
  scheduledInterviews: number;
  generatedInterviews: number;
  totalParticipants: number;
  lastGeneratedAt: string | null;
};

export const buildInterviewSchedulerSummary = async (
  userId: string,
): Promise<InterviewSchedulerDashboardSummaryV1> => {
  const interviews = await db.select().from(Interviews).where(eq(Interviews.userId, userId));
  const interviewIds = interviews.map((interview) => String(interview.id));
  const generatedInterviews = interviews.filter((interview) => String(interview.status) === "generated");
  const scheduledInterviews = interviews.filter((interview) => String(interview.status) === "scheduled");

  let totalParticipants = 0;
  let lastGeneratedAt: string | null = null;

  if (interviewIds.length > 0) {
    const participantRows = await db
      .select({ interviewId: InterviewParticipants.interviewId })
      .from(InterviewParticipants)
      .where(inArray(InterviewParticipants.interviewId, interviewIds));
    totalParticipants = participantRows.length;

    const suggestionRows = await db
      .select({ createdAt: InterviewSuggestions.createdAt })
      .from(InterviewSuggestions)
      .where(inArray(InterviewSuggestions.interviewId, interviewIds));
    lastGeneratedAt =
      suggestionRows
        .map((row) => new Date(row.createdAt).toISOString())
        .sort((left, right) => right.localeCompare(left))[0] ?? null;
  }

  return {
    appId: APP_META.key,
    version: 1,
    updatedAt: new Date().toISOString(),
    totalInterviews: interviews.length,
    scheduledInterviews: scheduledInterviews.length,
    generatedInterviews: generatedInterviews.length,
    totalParticipants,
    lastGeneratedAt,
  };
};
