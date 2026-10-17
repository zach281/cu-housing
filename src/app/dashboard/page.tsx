import { redirect } from "next/navigation";

// The dashboard grows saved listings and messages in later milestones; for
// now its only section is the user's own listings.
export default function DashboardPage() {
  redirect("/dashboard/listings");
}
