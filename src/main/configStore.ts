import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { AppConfig } from "../shared/types";

const CONFIG_FILE = "leadflow-config.json";

function configPath(): string {
  return path.join(app.getPath("userData"), CONFIG_FILE);
}

export function loadPersistedConfig(): AppConfig | null {
  try {
    const file = configPath();
    if (!fs.existsSync(file)) {
      return null;
    }
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as AppConfig;
    if (!parsed.telegramBotToken?.trim()) {
      return null;
    }
    return normalizeConfig(parsed);
  } catch (error) {
    console.warn("[ConfigStore] failed to load config:", error);
    return null;
  }
}

export function savePersistedConfig(config: AppConfig): void {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(normalizeConfig(config), null, 2), "utf8");
}

export function mergeConfigFromEnv(config: AppConfig | null): AppConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!config && !token) {
    return null;
  }

  const base: AppConfig = config ?? emptyConfig();

  return normalizeConfig({
    ...base,
    telegramBotToken: token || base.telegramBotToken,
    googleSheetsId: process.env.GOOGLE_SHEETS_ID?.trim() || base.googleSheetsId,
    googleSheetsRange: process.env.GOOGLE_SHEETS_RANGE?.trim() || base.googleSheetsRange,
    googleServiceAccountJson:
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || base.googleServiceAccountJson,
    port: Number(process.env.PORT ?? base.port ?? 3000)
  });
}

function emptyConfig(): AppConfig {
  return {
    telegramBotToken: "",
    googleSheetsId: "",
    googleSheetsRange: "Leads!A:F",
    googleServiceAccountJson: "",
    port: 3000
  };
}

export function normalizeConfig(config: Partial<AppConfig>): AppConfig {
  return {
    ...emptyConfig(),
    ...config,
    telegramBotToken: config.telegramBotToken?.trim() ?? "",
    googleSheetsId: config.googleSheetsId?.trim() ?? "",
    googleSheetsRange: config.googleSheetsRange?.trim() || "Leads!A:F",
    googleServiceAccountJson: config.googleServiceAccountJson?.trim() ?? "",
    port: Number(config.port || 3000)
  };
}
