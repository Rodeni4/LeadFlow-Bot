import TelegramBot from "node-telegram-bot-api";
import type { AppConfig } from "../shared/types";
import type { LeadsService } from "./leadsService";

type Step = "name" | "phone" | "message";

interface Session {
  step: Step;
  draft: {
    name?: string;
    phone?: string;
    message?: string;
  };
}

export class TelegramBotService {
  private bot: TelegramBot | null = null;
  private readonly sessions = new Map<number, Session>();

  constructor(
    private readonly leadsService: LeadsService,
    private readonly config: AppConfig
  ) {}

  start(): void {
    if (this.bot) {
      return;
    }

    const token = this.config.telegramBotToken.trim();
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is required.");
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.bot.onText(/^\/start$/, (msg) => this.handleStart(msg.chat.id));
    this.bot.onText(/^\/help$/, (msg) => this.sendHelp(msg.chat.id));
    this.bot.onText(/^\/cancel$/, (msg) => this.handleCancel(msg.chat.id));
    this.bot.on("message", (msg) => this.handleMessage(msg.chat.id, msg.text ?? ""));
  }

  async stop(): Promise<void> {
    if (!this.bot) {
      return;
    }
    await this.bot.stopPolling();
    this.bot = null;
    this.sessions.clear();
  }

  private async handleStart(chatId: number): Promise<void> {
    this.sessions.set(chatId, { step: "name", draft: {} });
    await this.bot?.sendMessage(chatId, "Привет! Отправьте ваше имя.");
  }

  private async sendHelp(chatId: number): Promise<void> {
    await this.bot?.sendMessage(
      chatId,
      "Команды:\n/start - начать заявку\n/cancel - отменить текущую заявку"
    );
  }

  private async handleCancel(chatId: number): Promise<void> {
    this.sessions.delete(chatId);
    await this.bot?.sendMessage(chatId, "Заявка отменена.");
  }

  private async handleMessage(chatId: number, text: string): Promise<void> {
    if (!this.bot || text.startsWith("/")) {
      return;
    }

    const session = this.sessions.get(chatId);
    if (!session) {
      return;
    }

    if (session.step === "name") {
      session.draft.name = text;
      session.step = "phone";
      await this.bot.sendMessage(chatId, "Укажите телефон.");
      return;
    }

    if (session.step === "phone") {
      session.draft.phone = text;
      session.step = "message";
      await this.bot.sendMessage(chatId, "Добавьте комментарий к заявке.");
      return;
    }

    session.draft.message = text;
    try {
      await this.leadsService.createLead({
        source: "telegram",
        name: session.draft.name ?? "",
        phone: session.draft.phone ?? "",
        message: session.draft.message ?? ""
      });
      await this.bot.sendMessage(chatId, "Спасибо! Заявка сохранена.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await this.bot.sendMessage(chatId, `Ошибка: ${message}`);
    } finally {
      this.sessions.delete(chatId);
    }
  }
}
