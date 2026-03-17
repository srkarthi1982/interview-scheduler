import { defineDb } from "astro:db";
import { InterviewParticipants, Interviews, InterviewSuggestions } from "./tables";

export default defineDb({
  tables: {
    Interviews,
    InterviewParticipants,
    InterviewSuggestions,
  },
});
