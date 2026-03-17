import type { Alpine } from "alpinejs";
import { registerAppDrawerStore } from "./modules/app/drawerStore";
import { registerInterviewSchedulerStore } from "./modules/interview-scheduler/store";

export default function initAlpine(Alpine: Alpine) {
  registerAppDrawerStore(Alpine);
  registerInterviewSchedulerStore(Alpine);

  if (typeof window !== "undefined") {
    window.Alpine = Alpine;
  }
}
