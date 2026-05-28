import { google } from "googleapis";
import type { AppConfig, Lead } from "../shared/types";

const DEFAULT_RANGE = "Leads!A:F";

export class GoogleSheetsService {
  private readonly spreadsheetId: string;
  private readonly range: string;
  private readonly authClient;

  constructor(config: AppConfig) {
    this.spreadsheetId = config.googleSheetsId.trim();
    this.range = config.googleSheetsRange.trim() || DEFAULT_RANGE;

    if (!this.spreadsheetId) {
      throw new Error("GOOGLE_SHEETS_ID is required.");
    }

    const credentialsRaw = config.googleServiceAccountJson.trim();
    if (!credentialsRaw) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is required.");
    }

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
