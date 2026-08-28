// Suggested job titles for the Designation field. These are suggestions, not a
// closed set: designation is display text that labels a person in workflow
// pickers, timelines, and exported PDFs, so any organization must be able to
// type a title this list does not anticipate. Every input using it stays a
// free-text field backed by a datalist.
export const DESIGNATION_SUGGESTIONS = [
  "Chief Executive Officer",
  "Managing Director",
  "Director",
  "General Manager",
  "Head of Department",
  "Head of Finance",
  "Head of Operations",
  "Head of HR",
  "Finance Manager",
  "Operations Manager",
  "HR Manager",
  "Procurement Officer",
  "Accounts Officer",
  "Administrative Officer",
  "Administrator",
  "Project Manager",
  "Team Lead",
  "Engineer",
  "Analyst",
  "Officer",
  "Executive",
  "Assistant",
] as const;

export const DESIGNATION_LIST_ID = "designation-suggestions";
