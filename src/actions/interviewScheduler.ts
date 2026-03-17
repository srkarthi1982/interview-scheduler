import { randomUUID } from "node:crypto";
import { ActionError, defineAction, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  InterviewParticipants,
  Interviews,
  InterviewSuggestions,
  and,
  db,
  desc,
  eq,
  inArray,
} from "astro:db";
import { requireUser } from "./_guards";
import { APP_META } from "../app.meta";
import { buildInterviewSchedulerSummary } from "../dashboard/summary.schema";
import { notifyParent } from "../lib/notifyParent";
import { pushInterviewSchedulerActivity } from "../lib/pushActivity";
import { generateSuggestionsForInterview } from "../modules/interview-scheduler/engine";
import {
  INTERVIEW_STAGE_OPTIONS,
  PARTICIPANT_TYPE_OPTIONS,
  TIME_ZONE_OPTIONS,
  buildDetailResponse,
  normalizeDateKey,
  normalizeInterviewRow,
  normalizeMultilineText,
  normalizeParticipantRow,
  normalizeSuggestionRow,
  normalizeText,
  normalizeTimeValue,
  validateTimeZone,
} from "../modules/interview-scheduler/helpers";
import type { ParticipantDTO } from "../modules/interview-scheduler/types";

const interviewInputSchema = z.object({
  title: z.string().min(1),
  candidateName: z.string().min(1),
  candidateEmail: z.string().email().optional().or(z.literal("")),
  roleTitle: z.string().min(1),
  companyName: z.string().optional(),
  interviewStage: z.string().min(1),
  meetingDate: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(720),
  notes: z.string().optional(),
});

const participantInputSchema = z.object({
  interviewId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  participantType: z.string().min(1),
  timezone: z.string().min(1),
  availabilityStartLocal: z.string().min(1),
  availabilityEndLocal: z.string().min(1),
  preferredStartLocal: z.string().optional().or(z.literal("")),
  preferredEndLocal: z.string().optional().or(z.literal("")),
  isRequired: z.boolean().default(true),
});

const updateParticipantSchema = participantInputSchema.extend({
  id: z.string().min(1),
});

const interviewIdSchema = z.object({ id: z.string().min(1) });

const badRequest = (message: string): never => {
  throw new ActionError({ code: "BAD_REQUEST", message });
};

const notFound = (message: string): never => {
  throw new ActionError({ code: "NOT_FOUND", message });
};

const normalizeInterviewInput = (input: z.infer<typeof interviewInputSchema>) => {
  const title = normalizeText(input.title);
  const candidateName = normalizeText(input.candidateName);
  const candidateEmail = normalizeText(input.candidateEmail ?? "") || null;
  const roleTitle = normalizeText(input.roleTitle);
  const companyName = normalizeText(input.companyName ?? "") || null;
  const interviewStage = normalizeText(input.interviewStage);
  const meetingDate = normalizeDateKey(input.meetingDate);
  const durationMinutes = Number(input.durationMinutes ?? 0);
  const notes = normalizeMultilineText(input.notes ?? "");

  if (!title) badRequest("Title is required.");
  if (!candidateName) badRequest("Candidate name is required.");
  if (!roleTitle) badRequest("Role title is required.");
  if (!meetingDate) badRequest("Interview date is required.");
  if (!INTERVIEW_STAGE_OPTIONS.includes(interviewStage as (typeof INTERVIEW_STAGE_OPTIONS)[number])) {
    badRequest("Choose a valid interview stage.");
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
    badRequest("Duration must be at least 15 minutes.");
  }

  return {
    title,
    candidateName,
    candidateEmail,
    roleTitle,
    companyName,
    interviewStage,
    meetingDate: meetingDate as string,
    durationMinutes,
    notes: notes || null,
  };
};

const normalizeParticipantInput = (input: z.infer<typeof participantInputSchema>) => {
  const name = normalizeText(input.name);
  const email = normalizeText(input.email ?? "") || null;
  const participantType = normalizeText(input.participantType);
  const timezone = validateTimeZone(input.timezone);
  const availabilityStartLocal = normalizeTimeValue(input.availabilityStartLocal);
  const availabilityEndLocal = normalizeTimeValue(input.availabilityEndLocal);
  const preferredStartLocal = normalizeTimeValue(input.preferredStartLocal ?? "");
  const preferredEndLocal = normalizeTimeValue(input.preferredEndLocal ?? "");

  if (!name) badRequest("Participant name is required.");
  if (!PARTICIPANT_TYPE_OPTIONS.includes(participantType as ParticipantDTO["participantType"])) {
    badRequest("Choose a valid participant type.");
  }
  if (!timezone) badRequest("Choose a valid time zone.");
  if (!availabilityStartLocal || !availabilityEndLocal) {
    badRequest("Availability start and end times are required.");
  }
  if ((preferredStartLocal && !preferredEndLocal) || (!preferredStartLocal && preferredEndLocal)) {
    badRequest("Preferred hours need both a start and end time.");
  }

  return {
    name,
    email,
    participantType: participantType as ParticipantDTO["participantType"],
    timezone: timezone as string,
    availabilityStartLocal: availabilityStartLocal as string,
    availabilityEndLocal: availabilityEndLocal as string,
    preferredStartLocal: preferredStartLocal || null,
    preferredEndLocal: preferredEndLocal || null,
    isRequired: Boolean(input.isRequired),
  };
};

const findInterviewForUser = async (userId: string, interviewId: string) => {
  const row = await db
    .select()
    .from(Interviews)
    .where(and(eq(Interviews.id, interviewId), eq(Interviews.userId, userId)))
    .get();
  return row ?? null;
};

const findParticipantWithInterview = async (userId: string, participantId: string) => {
  const participant = await db
    .select()
    .from(InterviewParticipants)
    .where(eq(InterviewParticipants.id, participantId))
    .get();
  if (!participant) return null;
  const interview = await findInterviewForUser(userId, String(participant.interviewId));
  if (!interview) return null;
  return { participant, interview };
};

const findSuggestionWithInterview = async (userId: string, suggestionId: string) => {
  const suggestion = await db
    .select()
    .from(InterviewSuggestions)
    .where(eq(InterviewSuggestions.id, suggestionId))
    .get();
  if (!suggestion) return null;
  const interview = await findInterviewForUser(userId, String(suggestion.interviewId));
  if (!interview) return null;
  return { suggestion, interview };
};

const markInterviewNeedsRegeneration = async (interviewId: string) => {
  await db.delete(InterviewSuggestions).where(eq(InterviewSuggestions.interviewId, interviewId));
  await db
    .update(Interviews)
    .set({
      status: "draft",
      selectedSuggestionId: null,
      updatedAt: new Date(),
    })
    .where(eq(Interviews.id, interviewId));
};

const buildInterviewListMeta = async (interviews: any[]) => {
  const interviewIds = interviews.map((interview) => String(interview.id));
  const meta = new Map<
    string,
    { participantCount: number; suggestionCount: number; selectedSuggestionLabel: string | null }
  >();
  if (interviewIds.length === 0) return meta;

  const participants = await db
    .select({ interviewId: InterviewParticipants.interviewId })
    .from(InterviewParticipants)
    .where(inArray(InterviewParticipants.interviewId, interviewIds));
  const suggestions = await db
    .select({
      interviewId: InterviewSuggestions.interviewId,
      label: InterviewSuggestions.label,
      isSelected: InterviewSuggestions.isSelected,
    })
    .from(InterviewSuggestions)
    .where(inArray(InterviewSuggestions.interviewId, interviewIds));

  for (const interviewId of interviewIds) {
    const participantCount = participants.filter((participant) => String(participant.interviewId) === interviewId).length;
    const interviewSuggestions = suggestions.filter((suggestion) => String(suggestion.interviewId) === interviewId);
    const selectedSuggestionLabel =
      interviewSuggestions.find((suggestion) => suggestion.isSelected)?.label?.toString() ?? null;
    meta.set(interviewId, {
      participantCount,
      suggestionCount: interviewSuggestions.length,
      selectedSuggestionLabel,
    });
  }

  return meta;
};

const loadParticipantsForInterview = async (interviewId: string) => {
  const rows = await db
    .select()
    .from(InterviewParticipants)
    .where(eq(InterviewParticipants.interviewId, interviewId))
    .orderBy(InterviewParticipants.sortOrder, InterviewParticipants.createdAt);
  return rows.map(normalizeParticipantRow);
};

const loadSuggestionsForInterview = async (interviewId: string, participants: ParticipantDTO[]) => {
  const rows = await db
    .select()
    .from(InterviewSuggestions)
    .where(eq(InterviewSuggestions.interviewId, interviewId))
    .orderBy(
      desc(InterviewSuggestions.isSelected),
      desc(InterviewSuggestions.score),
      InterviewSuggestions.startUtc,
    );

  return rows.map((row) => {
    const coveredParticipantIds = normalizeText(row.coveredParticipantIds ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const preferredParticipantIds = normalizeText(row.preferredParticipantIds ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return normalizeSuggestionRow(row, participants, coveredParticipantIds, preferredParticipantIds);
  });
};

const loadInterviewDetail = async (userId: string, interviewId: string) => {
  const interviewRow = await findInterviewForUser(userId, interviewId);
  if (!interviewRow) return null;

  const participants = await loadParticipantsForInterview(interviewId);
  const suggestions = await loadSuggestionsForInterview(interviewId, participants);
  const interview = normalizeInterviewRow(interviewRow, {
    participantCount: participants.length,
    suggestionCount: suggestions.length,
    selectedSuggestionLabel: suggestions.find((suggestion) => suggestion.isSelected)?.label ?? null,
  });

  return buildDetailResponse({ interview, participants, suggestions });
};

const emitAppEvent = (params: {
  userId: string;
  title: string;
  message: string;
  level?: "info" | "success" | "warning" | "error";
  meta?: Record<string, unknown>;
  activityEvent: string;
  entityId?: string;
}) => {
  void notifyParent({
    appKey: APP_META.key,
    userId: params.userId,
    title: params.title,
    message: params.message,
    level: params.level,
    meta: params.meta,
  });

  void (async () => {
    const summary = await buildInterviewSchedulerSummary(params.userId);
    await pushInterviewSchedulerActivity({
      userId: params.userId,
      activity: {
        event: params.activityEvent,
        occurredAt: new Date().toISOString(),
        entityId: params.entityId,
      },
      summary,
    });
  })();
};

export const listInterviews = defineAction({
  async handler(_input, context: ActionAPIContext) {
    const user = requireUser(context);
    const interviews = await db
      .select()
      .from(Interviews)
      .where(eq(Interviews.userId, user.id))
      .orderBy(desc(Interviews.updatedAt), desc(Interviews.createdAt));

    const meta = await buildInterviewListMeta(interviews);
    return {
      interviews: interviews.map((interview) => normalizeInterviewRow(interview, meta.get(String(interview.id)))),
      timezoneOptions: TIME_ZONE_OPTIONS,
      interviewStages: [...INTERVIEW_STAGE_OPTIONS],
      participantTypes: [...PARTICIPANT_TYPE_OPTIONS],
    };
  },
});

export const getInterviewDetail = defineAction({
  input: interviewIdSchema,
  async handler({ id }, context: ActionAPIContext) {
    const user = requireUser(context);
    const detail = await loadInterviewDetail(user.id, id);
    if (!detail) notFound("Interview not found.");
    return {
      detail,
      timezoneOptions: TIME_ZONE_OPTIONS,
      interviewStages: [...INTERVIEW_STAGE_OPTIONS],
      participantTypes: [...PARTICIPANT_TYPE_OPTIONS],
    };
  },
});

export const createInterview = defineAction({
  input: interviewInputSchema,
  async handler(input, context: ActionAPIContext) {
    const user = requireUser(context);
    const payload = normalizeInterviewInput(input);
    const now = new Date();

    const inserted = await db
      .insert(Interviews)
      .values({
        id: randomUUID(),
        userId: user.id,
        ...payload,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const interview = normalizeInterviewRow(inserted[0], {
      participantCount: 0,
      suggestionCount: 0,
      selectedSuggestionLabel: null,
    });

    emitAppEvent({
      userId: user.id,
      title: "Interview created",
      message: `“${payload.title}” is ready for participants.`,
      meta: { interviewId: interview.id },
      activityEvent: "interviews.created",
      entityId: interview.id,
    });

    return { interview };
  },
});

export const updateInterview = defineAction({
  input: interviewIdSchema.extend({ data: interviewInputSchema }),
  async handler({ id, data }, context: ActionAPIContext) {
    const user = requireUser(context);
    const existing = await findInterviewForUser(user.id, id);
    if (!existing) notFound("Interview not found.");
    const payload = normalizeInterviewInput(data);

    const interviewRecord = existing as NonNullable<typeof existing>;
    const requiresReset =
      normalizeText(interviewRecord.title) !== payload.title ||
      normalizeText(interviewRecord.candidateName) !== payload.candidateName ||
      normalizeText(interviewRecord.roleTitle) !== payload.roleTitle ||
      String(interviewRecord.meetingDate) !== payload.meetingDate ||
      Number(interviewRecord.durationMinutes) !== payload.durationMinutes;

    await db
      .update(Interviews)
      .set({
        ...payload,
        status: requiresReset ? "draft" : interviewRecord.status,
        selectedSuggestionId: requiresReset ? null : interviewRecord.selectedSuggestionId,
        updatedAt: new Date(),
      })
      .where(eq(Interviews.id, id));

    if (requiresReset) {
      await db.delete(InterviewSuggestions).where(eq(InterviewSuggestions.interviewId, id));
    }

    const detail = await loadInterviewDetail(user.id, id);
    if (!detail) notFound("Interview not found.");
    return { detail };
  },
});

export const archiveInterview = defineAction({
  input: interviewIdSchema,
  async handler({ id }, context: ActionAPIContext) {
    const user = requireUser(context);
    const existing = await findInterviewForUser(user.id, id);
    if (!existing) notFound("Interview not found.");
    const interviewRecord = existing as NonNullable<typeof existing>;

    await db
      .update(Interviews)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(Interviews.id, id));

    emitAppEvent({
      userId: user.id,
      title: "Interview archived",
      message: `“${normalizeText(interviewRecord.title)}” moved to archive.`,
      meta: { interviewId: id },
      activityEvent: "interviews.archived",
      entityId: id,
    });

    return { ok: true };
  },
});

export const deleteInterview = defineAction({
  input: interviewIdSchema,
  async handler({ id }, context: ActionAPIContext) {
    const user = requireUser(context);
    const existing = await findInterviewForUser(user.id, id);
    if (!existing) notFound("Interview not found.");

    await db.delete(InterviewSuggestions).where(eq(InterviewSuggestions.interviewId, id));
    await db.delete(InterviewParticipants).where(eq(InterviewParticipants.interviewId, id));
    await db.delete(Interviews).where(eq(Interviews.id, id));

    return { ok: true };
  },
});

export const addParticipant = defineAction({
  input: participantInputSchema,
  async handler(input, context: ActionAPIContext) {
    const user = requireUser(context);
    const interview = await findInterviewForUser(user.id, input.interviewId);
    if (!interview) notFound("Interview not found.");
    const interviewRecord = interview as NonNullable<typeof interview>;
    const payload = normalizeParticipantInput(input);

    const currentParticipants = await db
      .select({ id: InterviewParticipants.id })
      .from(InterviewParticipants)
      .where(eq(InterviewParticipants.interviewId, input.interviewId));

    const now = new Date();
    const inserted = await db
      .insert(InterviewParticipants)
      .values({
        id: randomUUID(),
        interviewId: input.interviewId,
        ...payload,
        sortOrder: currentParticipants.length,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await markInterviewNeedsRegeneration(input.interviewId);

    emitAppEvent({
      userId: user.id,
      title: "Participant added",
      message: `${payload.name} was added to “${normalizeText(interviewRecord.title)}”.`,
      meta: { interviewId: input.interviewId, participantId: inserted[0]?.id ?? null },
      activityEvent: "participants.added",
      entityId: inserted[0]?.id ? String(inserted[0].id) : undefined,
    });

    const detail = await loadInterviewDetail(user.id, input.interviewId);
    if (!detail) notFound("Interview not found.");
    return { detail };
  },
});

export const updateParticipant = defineAction({
  input: updateParticipantSchema,
  async handler(input, context: ActionAPIContext) {
    const user = requireUser(context);
    const existing = await findParticipantWithInterview(user.id, input.id);
    if (!existing || String(existing.interview.id) !== input.interviewId) {
      notFound("Participant not found.");
    }
    const payload = normalizeParticipantInput(input);

    await db
      .update(InterviewParticipants)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(InterviewParticipants.id, input.id));

    await markInterviewNeedsRegeneration(input.interviewId);
    const detail = await loadInterviewDetail(user.id, input.interviewId);
    if (!detail) notFound("Interview not found.");
    return { detail };
  },
});

export const deleteParticipant = defineAction({
  input: z.object({ id: z.string().min(1), interviewId: z.string().min(1) }),
  async handler({ id, interviewId }, context: ActionAPIContext) {
    const user = requireUser(context);
    const existing = await findParticipantWithInterview(user.id, id);
    if (!existing || String(existing.interview.id) !== interviewId) {
      notFound("Participant not found.");
    }

    await db.delete(InterviewParticipants).where(eq(InterviewParticipants.id, id));
    await markInterviewNeedsRegeneration(interviewId);
    const detail = await loadInterviewDetail(user.id, interviewId);
    if (!detail) notFound("Interview not found.");
    return { detail };
  },
});

export const generateSuggestions = defineAction({
  input: interviewIdSchema,
  async handler({ id }, context: ActionAPIContext) {
    const user = requireUser(context);
    const interviewRow = await findInterviewForUser(user.id, id);
    if (!interviewRow) notFound("Interview not found.");
    const interviewRecord = interviewRow as NonNullable<typeof interviewRow>;

    const participants = await loadParticipantsForInterview(id);
    if (participants.length === 0) {
      badRequest("Add at least one participant before generating suggestions.");
    }

    const meetingDate = normalizeDateKey(String(interviewRecord.meetingDate));
    if (!meetingDate) badRequest("Interview date is invalid.");

    const generated = generateSuggestionsForInterview({
      meetingDate: meetingDate as string,
      durationMinutes: Number(interviewRecord.durationMinutes ?? 0),
      participants,
    });
    if (generated.length === 0) {
      badRequest("No interview slots fit the current participant availability.");
    }

    await db.delete(InterviewSuggestions).where(eq(InterviewSuggestions.interviewId, id));
    await db.insert(InterviewSuggestions).values(
      generated.map((suggestion) => ({
        id: suggestion.id,
        interviewId: id,
        startUtc: new Date(suggestion.startUtc),
        endUtc: new Date(suggestion.endUtc),
        participantCoverage: suggestion.participantCoverage,
        requiredCoverage: suggestion.requiredCoverage,
        score: suggestion.score,
        label: suggestion.label,
        explanation: suggestion.explanation,
        isSelected: suggestion.isSelected,
        coveredParticipantIds: suggestion.coveredParticipantIds.join(","),
        preferredParticipantIds: suggestion.preferredParticipantIds.join(","),
        participantsJson: JSON.stringify(suggestion.coveredParticipantIds),
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );

    const selectedSuggestionId = generated.find((suggestion) => suggestion.isSelected)?.id ?? null;
    await db
      .update(Interviews)
      .set({
        status: selectedSuggestionId ? "generated" : "draft",
        selectedSuggestionId,
        updatedAt: new Date(),
      })
      .where(eq(Interviews.id, id));

    emitAppEvent({
      userId: user.id,
      title: "Suggestions generated",
      message: `${generated.length} ranked interview slots generated for “${normalizeText(interviewRecord.title)}”.`,
      meta: { interviewId: id, suggestionCount: generated.length },
      activityEvent: "suggestions.generated",
      entityId: id,
    });

    const detail = await loadInterviewDetail(user.id, id);
    if (!detail) notFound("Interview not found.");
    return { detail };
  },
});

export const chooseSuggestion = defineAction({
  input: z.object({ id: z.string().min(1), interviewId: z.string().min(1) }),
  async handler({ id, interviewId }, context: ActionAPIContext) {
    const user = requireUser(context);
    const existing = await findSuggestionWithInterview(user.id, id);
    if (!existing || String(existing.interview.id) !== interviewId) {
      notFound("Suggestion not found.");
    }

    await db
      .update(InterviewSuggestions)
      .set({ isSelected: false, updatedAt: new Date() })
      .where(eq(InterviewSuggestions.interviewId, interviewId));
    await db
      .update(InterviewSuggestions)
      .set({ isSelected: true, updatedAt: new Date() })
      .where(eq(InterviewSuggestions.id, id));
    await db
      .update(Interviews)
      .set({
        selectedSuggestionId: id,
        status: "scheduled",
        updatedAt: new Date(),
      })
      .where(eq(Interviews.id, interviewId));

    emitAppEvent({
      userId: user.id,
      title: "Interview slot selected",
      message: "A final interview slot was selected.",
      meta: { interviewId, suggestionId: id },
      activityEvent: "suggestions.selected",
      entityId: id,
    });

    const detail = await loadInterviewDetail(user.id, interviewId);
    if (!detail) notFound("Interview not found.");
    return { detail };
  },
});
