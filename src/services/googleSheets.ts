import { google } from "googleapis";
import type { AppConfig, Lead } from "../shared/types";

const DEFAULT_RANGE = "Leads!A:F";

export function createGoogleSheetsService(config: AppConfig): GoogleSheetsService | null {
  const spreadsheetId = config.googleSheetsId.trim();
  const credentialsRaw = config.googleServiceAccountJson.trim();
  if (!spreadsheetId || !credentialsRaw) {
    return null;
  }
  return new GoogleSheetsService(config);
}

export class GoogleSheetsService {
  private readonly spreadsheetId: string;
  private readonly range: string;
  private readonly authClient;

  constructor(config: AppConfig) {
    this.spreadsheetId = config.googleSheetsId.trim();
    this.range = config.googleSheetsRange.trim() || DEFAULT_RANGE;

    const credentialsRaw = config.googleServiceAccountJson.trim();
    const credentials = JSON.parse(credentialsRaw);
    this.authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
  }

  async appendLead(lead: Lead): Promise<void> {
    const sheets = google.sheets({ version: "v4", auth: this.authClient });
    await sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[lead.id, lead.source, lead.name, lead.phone, lead.message, lead.createdAt]]
      }
    });
  }
}
