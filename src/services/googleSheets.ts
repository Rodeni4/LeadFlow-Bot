import { google } from "googleapis";
import type { AppConfig, Lead } from "../shared/types";
import { leadToSheetRow } from "./sheetRow";

const DEFAULT_RANGE = "Leads!A:F";

export type GoogleSheetsTestResult =
  | { ok: true; title: string; clientEmail: string }
  | { ok: false; error: string; clientEmail?: string };

export interface ServiceAccountCredentials {
  type: "service_account";
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

export function parseServiceAccountJson(raw: string): ServiceAccountCredentials {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Вставьте JSON Service Account.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Некорректный JSON Service Account.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("JSON Service Account должен быть объектом.");
  }

  const credentials = parsed as Record<string, unknown>;
  if (credentials.type !== "service_account") {
    throw new Error('В JSON должно быть "type": "service_account".');
  }
  if (typeof credentials.client_email !== "string" || !credentials.client_email.includes("@")) {
    throw new Error("В JSON отсутствует client_email.");
  }
  if (typeof credentials.private_key !== "string" || !credentials.private_key.includes("BEGIN")) {
    throw new Error("В JSON отсутствует private_key.");
  }

  return credentials as ServiceAccountCredentials;
}

export function createGoogleSheetsService(config: AppConfig): GoogleSheetsService | null {
  const spreadsheetId = config.googleSheetsId.trim();
  const credentialsRaw = config.googleServiceAccountJson.trim();
  if (!spreadsheetId || !credentialsRaw) {
    return null;
  }

  try {
    return new GoogleSheetsService(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[GoogleSheets] disabled:", message);
    return null;
  }
}

export async function testGoogleSheetsConnection(config: AppConfig): Promise<GoogleSheetsTestResult> {
  const spreadsheetId = config.googleSheetsId.trim();
  if (!spreadsheetId) {
    return { ok: false, error: "Укажите Google Sheets ID." };
  }

  let clientEmail: string;
  try {
    clientEmail = parseServiceAccountJson(config.googleServiceAccountJson).client_email;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Некорректный JSON Service Account.";
    return { ok: false, error: message };
  }

  try {
    const service = new GoogleSheetsService(config);
    const title = await service.getSpreadsheetTitle();
    return { ok: true, title, clientEmail };
  } catch (error) {
    return {
      ok: false,
      error: formatGoogleSheetsError(error, clientEmail),
      clientEmail
    };
  }
}

export class GoogleSheetsService {
  private readonly spreadsheetId: string;
  private readonly range: string;
  private readonly authClient;

  constructor(config: AppConfig) {
    this.spreadsheetId = config.googleSheetsId.trim();
    this.range = config.googleSheetsRange.trim() || DEFAULT_RANGE;
    const credentials = parseServiceAccountJson(config.googleServiceAccountJson);
    this.authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
  }

  async getSpreadsheetTitle(): Promise<string> {
    const sheets = google.sheets({ version: "v4", auth: this.authClient });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "properties.title"
    });
    return response.data.properties?.title?.trim() || "Google Sheet";
  }

  async appendLead(lead: Lead): Promise<void> {
    const row = leadToSheetRow(lead);
    if (/^[0-9a-f-]{36}$/i.test(row[0] ?? "")) {
      console.error("[GoogleSheets] invalid Date column (UUID). Restart the Electron app.");
    }
    console.log("[GoogleSheets] row:", row.join(" | "));
    const sheets = google.sheets({ version: "v4", auth: this.authClient });
    await sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row]
      }
    });
  }

  async clearLeadRows(): Promise<void> {
    const sheets = google.sheets({ version: "v4", auth: this.authClient });
    await sheets.spreadsheets.values.clear({
      spreadsheetId: this.spreadsheetId,
      range: buildDataClearRange(this.range)
    });
  }
}

/** Clears data rows (row 2+) — header row is kept. */
export function buildDataClearRange(range: string): string {
  const trimmed = range.trim() || DEFAULT_RANGE;
  const bang = trimmed.indexOf("!");
  const sheet = (bang >= 0 ? trimmed.slice(0, bang) : "Leads").replace(/^'|'$/g, "");
  const colsPart = bang >= 0 ? trimmed.slice(bang + 1) : "A:F";
  const colMatch = colsPart.match(/^([A-Za-z]+)(?::([A-Za-z]+))?/);
  const startCol = (colMatch?.[1] ?? "A").toUpperCase();
  const endCol = (colMatch?.[2] ?? colMatch?.[1] ?? "F").toUpperCase();
  const quotedSheet = sheet.includes(" ") || sheet.includes("'") ? `'${sheet.replace(/'/g, "''")}'` : sheet;
  return `${quotedSheet}!${startCol}2:${endCol}5000`;
}

function formatGoogleSheetsError(error: unknown, clientEmail: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = extractErrorCode(error);

  if (code === 404 || /not found/i.test(raw)) {
    return "Таблица не найдена. Проверьте Google Sheets ID.";
  }
  if (code === 403 || /permission|forbidden/i.test(raw)) {
    return `Нет доступа к таблице. Откройте Google Sheet → «Настройки доступа» → добавьте редактором:\n${clientEmail}`;
  }
  if (/invalid_grant|account not found/i.test(raw)) {
    return "Service Account недействителен. Скачайте новый JSON-ключ в Google Cloud.";
  }
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|network/i.test(raw)) {
    return "Нет доступа к Google API. Проверьте интернет или прокси.";
  }

  return raw || "Не удалось подключиться к Google Sheets.";
}

function extractErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const withCode = error as { code?: number | string; response?: { status?: number } };
  if (typeof withCode.code === "number") {
    return withCode.code;
  }
  if (typeof withCode.response?.status === "number") {
    return withCode.response.status;
  }
  return undefined;
}
