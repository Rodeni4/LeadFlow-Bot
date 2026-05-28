export type LeadSource = "telegram" | "website";

export interface Lead {
  id: string;
  source: LeadSource;
  name: string;
  phone: string;
  message: string;
  createdAt: string;
  /** @username or id:123 — only for telegram leads */
  telegram?: string;
}

export interface CreateLeadInput {
  source: LeadSource;
  name: string;
  phone: string;
  message: string;
  telegram?: string;
}

export interface ClearLeadsResult {
  leads: Lead[];
  sheetsCleared: boolean;
}

export interface ServiceStatus {
  bot: "running" | "stopped" | "error";
  website: "running" | "stopped" | "error";
}

export interface AppConfig {
  telegramBotToken: string;
  googleSheetsId: string;
  googleSheetsRange: string;
  googleServiceAccountJson: string;
  port: number;
  proxyHost: string;
  proxyPort: number;
  proxyUsername: string;
  proxyPassword: string;
  proxyEnabled: boolean;
}
