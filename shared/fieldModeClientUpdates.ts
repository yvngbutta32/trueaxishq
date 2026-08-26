export const fieldModeUpdateTemplates = [
  {
    id: "on-the-way",
    label: "On my way",
    message: "I’m on my way and will share an update when I arrive.",
  },
  {
    id: "work-started",
    label: "Work started",
    message: "Work has started. I’ll keep you updated as the job progresses.",
  },
  {
    id: "next-step",
    label: "Next step",
    message: "Here is the next step for your job: ",
  },
  {
    id: "work-complete",
    label: "Work complete",
    message: "The planned work is complete. Please review the latest update in your client portal.",
  },
] as const;

export function chooseFieldModeUpdateTemplate(templateId: string): string | null {
  return fieldModeUpdateTemplates.find(template => template.id === templateId)?.message ?? null;
}
