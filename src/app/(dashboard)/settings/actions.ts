"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { settingsApi } from "@/lib/api-client";
import { notifySettings } from "@/lib/notify";

export async function saveSettings(formData: FormData) {
  await requireRole("ADMIN");

  const data = {
    appName:                 String(formData.get("appName") || "").trim() || undefined,
    supportEmail:            String(formData.get("supportEmail") || "").trim() || undefined,
    termsUrl:                String(formData.get("termsUrl") || "").trim() || undefined,
    privacyUrl:              String(formData.get("privacyUrl") || "").trim() || undefined,
    maintenanceMode:         formData.get("maintenanceMode") === "on",
    registrationEnabled:     formData.get("registrationEnabled") === "on",
    minAppVersion:           String(formData.get("minAppVersion") || "").trim() || undefined,
    forceUpdateVersion:      String(formData.get("forceUpdateVersion") || "").trim() || undefined,
    coinToUsdRate:           parseFloat(String(formData.get("coinToUsdRate") || "0.01")),
    giftCommissionRate:      parseFloat(String(formData.get("giftCommissionRate") || "0.3")),
    agencyCommissionDefault: parseFloat(String(formData.get("agencyCommissionDefault") || "0.3")),
    maxRoomSeats:            parseInt(String(formData.get("maxRoomSeats") || "20"), 10),
    defaultRoomType:         String(formData.get("defaultRoomType") || "PUBLIC") as "PUBLIC" | "PRIVATE",
  };

  await settingsApi.update(data);
  await notifySettings(data as Record<string, unknown>);
  revalidatePath("/settings");
}

export async function flushSettingsCache() {
  await requireRole("ADMIN");
  await settingsApi.flush();
  revalidatePath("/settings");
}
