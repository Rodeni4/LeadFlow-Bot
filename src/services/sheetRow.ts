import type { Lead } from "../shared/types";

/** Columns: Date | Source | Full Name | Phone | Email | Telegram */
export function leadToSheetRow(lead: Lead): string[] {
  const dateTime = formatSheetDateTime(lead.createdAt);
  const telegramColumn = lead.source === "telegram" ? lead.telegram?.trim() || "" : "";

  return [dateTime, lead.source, lead.name, lead.phone, lead.message, telegramColumn];
}

export function formatSheetDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}
