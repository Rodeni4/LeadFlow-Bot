import type { AppConfig, ServiceStatus } from "../shared/types";
import { GoogleSheetsService } from "../services/googleSheets";
import { LeadsService } from "../services/leadsService";
import { LocalStore } from "../services/localStore";
import { TelegramBotService } from "../services/telegramBot";
import { WebServerService } from "../services/webServer";

export class AppOrchestrator {
  private readonly localStore = new LocalStore();
  private config: AppConfig | null = null;
  private leadsService: LeadsService | null = null;
  private botService: TelegramBotService | null = null;
  private webService: WebServerService | null = null;

  private status: ServiceStatus = { bot: "stopped", website: "stopped" };

  constructor(initialConfig: AppConfig | null) {
    if (initialConfig) {
      this.setConfig(initialConfig);
    }
  }

  onLeadAdded(listener: () => void): void {
    this.localStore.on("leadAdded", listener);
  }

  getStatus(): ServiceStatus {
    return this.status;
  }

  getConfig(): AppConfig | null {
    return this.config;
  }

  setConfig(config: AppConfig): void {
    this.ensureStopped();
    this.config = {
      ...config,
      googleSheetsRange: config.googleSheetsRange.trim() || "Leads!A:F",
      port: Number(config.port || 3000)
    };
    const sheetsService = new GoogleSheetsService(this.config);
    this.leadsService = new LeadsService(this.localStore, sheetsService);
    this.botService = new TelegramBotService(this.leadsService, this.config);
    this.webService = new WebServerService(this.leadsService, this.config);
  }

  getLeads() {
    return this.localStore.getLeads();
  }

  startBot(): void {
    if (!this.botService) {
      throw new Error("Save config first in the Authorization block.");
    }
    try {
      this.botService.start();
      this.status.bot = "running";
    } catch {
      this.status.bot = "error";
      throw new Error("Failed to start Telegram bot.");
    }
  }

  async stopBot(): Promise<void> {
    await this.botService?.stop();
    this.status.bot = "stopped";
  }

  async startWebsite(): Promise<void> {
    if (!this.webService) {
      throw new Error("Save config first in the Authorization block.");
    }
    try {
      await this.webService.start();
      this.status.website = "running";
    } catch {
      this.status.website = "error";
      throw new Error("Failed to start website.");
    }
  }

  async stopWebsite(): Promise<void> {
    await this.webService?.stop();
    this.status.website = "stopped";
  }

  async shutdown(): Promise<void> {
    await this.stopBot();
    await this.stopWebsite();
  }

  private ensureStopped(): void {
    if (this.status.bot === "running" || this.status.website === "running") {
      throw new Error("Stop bot and website before updating config.");
    }
  }
}
