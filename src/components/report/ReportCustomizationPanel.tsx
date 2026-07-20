"use client";

import { Loader2 } from "lucide-react";
import { useUserProfile } from "@/hooks/useCosmetics";
import ReportBrandingEditor from "./ReportBrandingEditor";
import ReportCustomizationLockedOverlay from "./ReportCustomizationLockedOverlay";

/**
 * Self-contained report customization panel: gates on the report customization
 * module (admin or has_report_customization). Locked → blurred demo editor
 * behind an upsell overlay; unlocked → the real editor. Used both as a tab in
 * the comparison view and as a section in the profile page.
 */
export default function ReportCustomizationPanel() {
  const { data: profile, isLoading } = useUserProfile();
  const unlocked =
    !!profile &&
    (profile.role === "ADMIN" ||
      profile.role === "SCILICIUM_ADMIN" ||
      profile.has_report_customization === true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <ReportCustomizationLockedOverlay>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
          <ReportBrandingEditor demo />
        </div>
      </ReportCustomizationLockedOverlay>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow">
      <ReportBrandingEditor />
    </div>
  );
}
