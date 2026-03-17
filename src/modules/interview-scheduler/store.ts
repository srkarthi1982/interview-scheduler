import type { Alpine } from "alpinejs";
import { AvBaseStore } from "@ansiversa/components/alpine";
import { actions } from "astro:actions";
import type { InterviewDTO, InterviewDetailDTO, ParticipantDTO, ParticipantType, SuggestionDTO } from "./types";

const emptyInterviewForm = () => ({
  title: "",
  candidateName: "",
  candidateEmail: "",
  roleTitle: "",
  companyName: "",
  interviewStage: "Screening",
  meetingDate: "",
  durationMinutes: 60,
  notes: "",
});

const emptyParticipantForm = () => ({
  id: "",
  name: "",
  email: "",
  participantType: "interviewer" as ParticipantType,
  timezone: "UTC",
  availabilityStartLocal: "09:00",
  availabilityEndLocal: "17:00",
  preferredStartLocal: "",
  preferredEndLocal: "",
  isRequired: true,
});

export class InterviewSchedulerStore extends AvBaseStore {
  interviews: InterviewDTO[] = [];
  interview: InterviewDTO | null = null;
  participants: ParticipantDTO[] = [];
  suggestions: SuggestionDTO[] = [];
  timezoneOptions: string[] = [];
  interviewStages: string[] = [];
  participantTypes: ParticipantType[] = [];
  interviewForm = emptyInterviewForm();
  participantForm = emptyParticipantForm();
  createDrawerOpen = false;
  participantDrawerOpen = false;
  loading = false;
  createLoading = false;
  participantLoading = false;
  suggestionsLoading = false;
  error: string | null = null;
  success: string | null = null;

  private unwrapResult<T = any>(result: any): T {
    if (result?.error) {
      const message = result.error?.message || result.error;
      throw new Error(message || "Request failed.");
    }
    return (result?.data ?? result) as T;
  }

  initList(initial: {
    interviews: InterviewDTO[];
    timezoneOptions: string[];
    interviewStages: string[];
    participantTypes: ParticipantType[];
  }) {
    this.interviews = initial.interviews ?? [];
    this.timezoneOptions = initial.timezoneOptions ?? [];
    this.interviewStages = initial.interviewStages ?? [];
    this.participantTypes = initial.participantTypes ?? [];
    this.interviewForm = emptyInterviewForm();
    if (this.interviewStages[0]) {
      this.interviewForm.interviewStage = this.interviewStages[0];
    }
    this.error = null;
    this.success = null;
  }

  initDetail(initial: {
    detail: InterviewDetailDTO;
    timezoneOptions: string[];
    interviewStages: string[];
    participantTypes: ParticipantType[];
  }) {
    this.timezoneOptions = initial.timezoneOptions ?? [];
    this.interviewStages = initial.interviewStages ?? [];
    this.participantTypes = initial.participantTypes ?? [];
    this.applyDetail(initial.detail);
    this.error = null;
    this.success = null;
  }

  private applyDetail(detail: InterviewDetailDTO) {
    this.interview = detail.interview;
    this.participants = detail.participants ?? [];
    this.suggestions = detail.suggestions ?? [];
    this.interviewForm = {
      title: detail.interview.title,
      candidateName: detail.interview.candidateName,
      candidateEmail: detail.interview.candidateEmail ?? "",
      roleTitle: detail.interview.roleTitle,
      companyName: detail.interview.companyName ?? "",
      interviewStage: detail.interview.interviewStage,
      meetingDate: detail.interview.meetingDate,
      durationMinutes: detail.interview.durationMinutes,
      notes: detail.interview.notes ?? "",
    };
    this.participantForm = emptyParticipantForm();
    if (this.timezoneOptions[0]) {
      this.participantForm.timezone = this.timezoneOptions.includes("UTC")
        ? "UTC"
        : this.timezoneOptions[0];
    }
  }

  openCreateDrawer() {
    this.createDrawerOpen = true;
    this.error = null;
    this.success = null;
  }

  closeCreateDrawer() {
    this.createDrawerOpen = false;
    this.interviewForm = emptyInterviewForm();
    if (this.interviewStages[0]) {
      this.interviewForm.interviewStage = this.interviewStages[0];
    }
  }

  openNewParticipantDrawer() {
    this.participantDrawerOpen = true;
    this.participantForm = emptyParticipantForm();
    if (this.timezoneOptions[0]) {
      this.participantForm.timezone = this.timezoneOptions.includes("UTC")
        ? "UTC"
        : this.timezoneOptions[0];
    }
  }

  openEditParticipantDrawer(participant: ParticipantDTO) {
    this.participantDrawerOpen = true;
    this.participantForm = {
      id: participant.id,
      name: participant.name,
      email: participant.email ?? "",
      participantType: participant.participantType,
      timezone: participant.timezone,
      availabilityStartLocal: participant.availabilityStartLocal,
      availabilityEndLocal: participant.availabilityEndLocal,
      preferredStartLocal: participant.preferredStartLocal ?? "",
      preferredEndLocal: participant.preferredEndLocal ?? "",
      isRequired: participant.isRequired,
    };
  }

  closeParticipantDrawer() {
    this.participantDrawerOpen = false;
    this.participantForm = emptyParticipantForm();
  }

  async createInterview() {
    this.createLoading = true;
    this.error = null;
    this.success = null;
    try {
      const result = await actions.interviewScheduler.createInterview({
        ...this.interviewForm,
        durationMinutes: Number(this.interviewForm.durationMinutes),
      });
      const data = this.unwrapResult<{ interview: InterviewDTO }>(result);
      if (typeof window !== "undefined" && data.interview?.id) {
        window.location.href = `/app/interviews/${data.interview.id}`;
      }
    } catch (error: any) {
      this.error = error?.message || "Unable to create interview.";
    } finally {
      this.createLoading = false;
    }
  }

  async saveInterview() {
    if (!this.interview) return;
    this.loading = true;
    this.error = null;
    this.success = null;
    try {
      const result = await actions.interviewScheduler.updateInterview({
        id: this.interview.id,
        data: {
          ...this.interviewForm,
          durationMinutes: Number(this.interviewForm.durationMinutes),
        },
      });
      const data = this.unwrapResult<{ detail: InterviewDetailDTO }>(result);
      this.applyDetail(data.detail);
      this.success = "Interview updated.";
    } catch (error: any) {
      this.error = error?.message || "Unable to save interview.";
    } finally {
      this.loading = false;
    }
  }

  async archiveInterview(id: string) {
    this.loading = true;
    this.error = null;
    this.success = null;
    try {
      await actions.interviewScheduler.archiveInterview({ id });
      if (typeof window !== "undefined") {
        window.location.href = "/app";
      }
    } catch (error: any) {
      this.error = error?.message || "Unable to archive interview.";
    } finally {
      this.loading = false;
    }
  }

  async deleteInterview(id: string) {
    this.loading = true;
    this.error = null;
    this.success = null;
    try {
      await actions.interviewScheduler.deleteInterview({ id });
      if (typeof window !== "undefined") {
        window.location.href = "/app";
      }
    } catch (error: any) {
      this.error = error?.message || "Unable to delete interview.";
    } finally {
      this.loading = false;
    }
  }

  async saveParticipant() {
    if (!this.interview) return;
    this.participantLoading = true;
    this.error = null;
    this.success = null;
    const isEditing = Boolean(this.participantForm.id);
    try {
      const payload = {
        interviewId: this.interview.id,
        ...this.participantForm,
        isRequired: Boolean(this.participantForm.isRequired),
      };
      const result = this.participantForm.id
        ? await actions.interviewScheduler.updateParticipant(payload)
        : await actions.interviewScheduler.addParticipant(payload);
      const data = this.unwrapResult<{ detail: InterviewDetailDTO }>(result);
      this.applyDetail(data.detail);
      this.closeParticipantDrawer();
      this.success = isEditing ? "Participant updated." : "Participant added.";
    } catch (error: any) {
      this.error = error?.message || "Unable to save participant.";
    } finally {
      this.participantLoading = false;
    }
  }

  async deleteParticipant(id: string) {
    if (!this.interview) return;
    this.loading = true;
    this.error = null;
    this.success = null;
    try {
      const result = await actions.interviewScheduler.deleteParticipant({
        id,
        interviewId: this.interview.id,
      });
      const data = this.unwrapResult<{ detail: InterviewDetailDTO }>(result);
      this.applyDetail(data.detail);
      this.success = "Participant removed.";
    } catch (error: any) {
      this.error = error?.message || "Unable to remove participant.";
    } finally {
      this.loading = false;
    }
  }

  async generateSuggestions() {
    if (!this.interview) return;
    this.suggestionsLoading = true;
    this.error = null;
    this.success = null;
    try {
      const result = await actions.interviewScheduler.generateSuggestions({ id: this.interview.id });
      const data = this.unwrapResult<{ detail: InterviewDetailDTO }>(result);
      this.applyDetail(data.detail);
      this.success = "Suggestions generated.";
    } catch (error: any) {
      this.error = error?.message || "Unable to generate suggestions.";
    } finally {
      this.suggestionsLoading = false;
    }
  }

  async selectSuggestion(id: string) {
    if (!this.interview) return;
    this.loading = true;
    this.error = null;
    this.success = null;
    try {
      const result = await actions.interviewScheduler.chooseSuggestion({
        id,
        interviewId: this.interview.id,
      });
      const data = this.unwrapResult<{ detail: InterviewDetailDTO }>(result);
      this.applyDetail(data.detail);
      this.success = "Interview slot selected.";
    } catch (error: any) {
      this.error = error?.message || "Unable to select suggestion.";
    } finally {
      this.loading = false;
    }
  }
}

export const registerInterviewSchedulerStore = (Alpine: Alpine) => {
  Alpine.store("interviewScheduler", new InterviewSchedulerStore());
};
