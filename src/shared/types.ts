export type LeadSource = "telegram" | "website";

export interface Lead {
  id: string;
  source: LeadSource;
  name: string;
  phone: string;
  message: string;
  createdAt: string;
}

export interface CreateLeadInput {
  source: LeadSource;
  name: string;
  phone: string;
  message: string;
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
}
