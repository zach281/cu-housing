// Product constants. The brand name is a placeholder: change it here only.
// Avoid names implying an official University of Colorado service.
export const site = {
  name: "Campus Nest",
  university: "CU Boulder",
  universityEmailDomain: "colorado.edu", // mirrors public.is_cu_email() in SQL
} as const;

export function isUniversityEmail(email: string): boolean {
  return email.trim().toLowerCase().split("@")[1] === site.universityEmailDomain;
}
