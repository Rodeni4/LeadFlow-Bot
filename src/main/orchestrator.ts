import type { AppConfig, ServiceStatus } from "../shared/types";
import { createGoogleSheetsService } from "../services/googleSheets";
import { LeadsService } from "../services/leadsService";
import { LocalStore } from "../services/localStore";
import { TelegramBotService } from "../services/telegramBot";
import { WebServerService } from "../services/webServer";

export class AppOrchestrator {
  private readonly localStore: LocalStore;
  private config: AppConfig | null = null;
  private leadsService: LeadsService | null = null;
  private botService: TelegramBotService | null = null;
  private webService: WebServerService | null = null;

  private status: ServiceStatus = { bot: "stopped", website: "stopped" };
  private statusListener: ((status: ServiceStatus, botError?: string) => void) | null = null;

  constructor(initialConfig: AppConfig | null, leadsPersistenceFile: string) {
    this.localStore = new LocalStore(leadsPersistenceFile);
    if (initialConfig) {
      this.setConfig(initialConfig);
    }
  }

  onLeadAdded(listener: () => void): void {
    this.localStore.on("leadAdded", listener);
  }

  setStatusListener(listener: (status: ServiceStatus, botError?: string) => void): void {
    this.statusListener = listener;
  }

  private notifyStatus(botError?: string): void {
    this.statusListener?.(this.getStatus(), botError);
  }

  getStatus(): ServiceStatus {
    return this.status;
  }

  getConfig(): AppConfig | null {
    return this.config;
  }

  setConfig(config: AppConfig): void {
    this.ensureStopped();
    this.applyConfig(config);
  }

  /** Saves settings; recreates bot (and restarts it if it was running). */
  async syncConfig(config: AppConfig): Promise<void> {
    const normalized = this.normalizeConfig(config);
    const botWasRunning = this.status.bot === "running";

    this.config = normalized;

    if (botWasRunning) {
      await this.botService?.stop();
      this.status.bot = "stopped";
    }

    const sheetsService = createGoogleSheetsService(this.config);
    this.leadsService = new LeadsService(this.localStore, sheetsService);
    this.botService = new TelegramBotService(this.config, {
      onNetworkError: (message) => this.handleBotNetworkError(message)
    });
    this.webService = new WebServerService(this.leadsService, this.config);

    if (botWasRunning) {
      await this.startBot();
    }
  }

  private applyConfig(config: AppConfig): void {
    this.config = this.normalizeConfig(config);
    const sheetsService = createGoogleSheetsService(this.config);
    this.leadsService = new LeadsService(this.localStore, sheetsService);
    this.botService = new TelegramBotService(this.config, {
      onNetworkError: (message) => this.handleBotNetworkError(message)
    });
    this.webService = new WebServerService(this.leadsService, this.config);
  }

  private normalizeConfig(config: AppConfig): AppConfig {
    return {
      telegramBotToken: config.telegramBotToken.trim(),
      googleSheetsId: config.googleSheetsId.trim(),
      googleSheetsRange: config.googleSheetsRange.trim() || "Leads!A:F",
      googleServiceAccountJson: config.googleServiceAccountJson.trim(),
      port: Number(config.port || 3000),
      proxyHost: config.proxyHost.trim(),
      proxyPort: Number(config.proxyPort || 0),
      proxyUsername: config.proxyUsername.trim(),
      proxyPassword: config.proxyPassword.trim(),
      proxyEnabled: Boolean(config.proxyEnabled)
    };
  }

  getLeads() {
    return this.localStore.getLeads();
  }

  async startBot(): Promise<void> {
    if (!this.botService) {
      throw new Error("Save config first in the Authorization block.");
    }
    try {
      await this.botService.start();
      this.status.bot = "running";
      this.notifyStatus();
    } catch (error) {
      this.status.bot = "error";
      const message = error instanceof Error ? error.message : "Failed to start Telegram bot.";
      this.notifyStatus(message);
      throw new Error(message);
    }
  }

  async stopBot(): Promise<void> {
    await this.botService?.stop();
    this.status.bot = "stopped";
    this.notifyStatus();
  }

  private handleBotNetworkError(message: string): void {
    this.status.bot = "error";
    this.notifyStatus(message);
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
    await this.botService?.stop();
    this.status.bot = "stopped";
    await this.webService?.stop();
    this.status.website = "stopped";
  }

  private ensureStopped(): void {
    if (this.status.bot === "running" || this.status.website === "running") {
      throw new Error("Stop bot and website before updating config.");
    }
  }
}
