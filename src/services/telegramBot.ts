import TelegramBot from "node-telegram-bot-api";
import type { AppConfig } from "../shared/types";
import type { LeadsService } from "./leadsService";

const START_COMMAND = /^\/start(?:@\w+)?(?:\s+.*)?$/i;
const HELP_COMMAND = /^\/help(?:@\w+)?(?:\s+.*)?$/i;
const CANCEL_COMMAND = /^\/cancel(?:@\w+)?(?:\s+.*)?$/i;

type LeadStep = "idle" | "name" | "phone" | "message";

interface ChatSession {
  step: LeadStep;
  name?: string;
  phone?: string;
}

export interface TelegramBotHooks {
  onNetworkError?: (message: string) => void;
}

export class TelegramBotService {
  private bot: TelegramBot | null = null;
  private networkErrorHandled = false;
  private readonly sessions = new Map<number, ChatSession>();

  constructor(
    private readonly config: AppConfig,
    private readonly leadsService: LeadsService,
    private readonly hooks: TelegramBotHooks = {}
  ) {}

  async start(): Promise<void> {
    if (this.bot) {
      return;
    }

    this.networkErrorHandled = false;
    const token = this.config.telegramBotToken.trim();
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is required.");
    }

    const configProxy = buildProxyFromConfig(this.config);
    const proxy = configProxy || process.env.TELEGRAM_PROXY?.trim() || process.env.HTTPS_PROXY?.trim();

    this.bot = new TelegramBot(token, {
      polling: true,
      ...(proxy ? { request: { proxy } as NonNullable<TelegramBot.ConstructorOptions["request"]> } : {})
    });
    this.registerHandlers();

    void this.bot
      .getMe()
      .then((me) => console.log(`[TelegramBot] lead intake, connected as @${me.username ?? me.id}`))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[TelegramBot] Telegram API unreachable:", message);
      });
  }

  async stop(): Promise<void> {
    if (!this.bot) {
      return;
    }
    try {
      await this.bot.stopPolling();
    } catch (error) {
      console.warn("[TelegramBot] stopPolling:", error);
    } finally {
      this.bot = null;
      this.sessions.clear();
    }
  }

  private registerHandlers(): void {
    if (!this.bot) {
      return;
    }

    this.bot.on("polling_error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[TelegramBot] polling_error:", message);
      if (isNetworkError(message)) {
        this.reportNetworkError(message);
      }
    });

    this.bot.onText(START_COMMAND, (msg) => {
      void this.beginLeadFlow(msg.chat.id).catch((err) => this.logHandlerError(err));
    });

    this.bot.onText(HELP_COMMAND, (msg) => {
      void this.reply(msg.chat.id, helpText()).catch((err) => this.logHandlerError(err));
    });

    this.bot.onText(CANCEL_COMMAND, (msg) => {
      void this.cancelFlow(msg.chat.id).catch((err) => this.logHandlerError(err));
    });

    this.bot.on("message", (msg) => {
      const text = msg.text?.trim();
      if (!text || text.startsWith("/")) {
        return;
      }
      void this.handleLeadStep(msg.chat.id, text).catch((err) => this.logHandlerError(err));
    });
  }

  private async beginLeadFlow(chatId: number): Promise<void> {
    this.sessions.set(chatId, { step: "name" });
    await this.reply(
      chatId,
      "Здравствуйте! Оставьте заявку — ответьте на несколько вопросов.\n\nКак вас зовут?"
    );
  }

  private async cancelFlow(chatId: number): Promise<void> {
    this.sessions.delete(chatId);
    await this.reply(chatId, "Заявка отменена. Чтобы начать снова, отправьте /start");
  }

  private async handleLeadStep(chatId: number, text: string): Promise<void> {
    const session = this.sessions.get(chatId);
    if (!session || session.step === "idle") {
      await this.reply(chatId, "Чтобы оставить заявку, отправьте /start\nСправка: /help");
      return;
    }

    if (session.step === "name") {
      if (text.length < 2) {
        await this.reply(chatId, "Укажите имя (минимум 2 символа).");
        return;
      }
      session.name = text;
      session.step = "phone";
      await this.reply(chatId, "Спасибо! Укажите номер телефона (например +7 900 123-45-67).");
      return;
    }

    if (session.step === "phone") {
      if (!isValidPhone(text)) {
        await this.reply(chatId, "Некорректный номер. Введите телефон с кодом страны (от 10 цифр).");
        return;
      }
      session.phone = text;
      session.step = "message";
      await this.reply(
        chatId,
        "Опишите запрос или комментарий.\nЧтобы пропустить — отправьте «-»."
      );
      return;
    }

    if (session.step === "message") {
      const message = text === "-" ? "" : text;
      const name = session.name ?? "";
      const phone = session.phone ?? "";

      try {
        await this.leadsService.createLead({
          source: "telegram",
          name,
          phone,
          message
        });
        this.sessions.delete(chatId);
        await this.reply(
          chatId,
          `Заявка принята. Спасибо, ${name}!\nМы свяжемся с вами по телефону ${phone}.\n\nНовая заявка: /start`
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Не удалось сохранить заявку.";
        await this.reply(chatId, `${detail}\nПопробуйте снова: /start`);
        this.sessions.delete(chatId);
      }
    }
  }

  private reportNetworkError(rawMessage: string): void {
    if (this.networkErrorHandled) {
      return;
    }
    this.networkErrorHandled = true;

    const hint = "Нет доступа к Telegram API. Проверьте интернет или VPN на компьютере.";
    const message = isNetworkError(rawMessage) ? hint : rawMessage;

    this.hooks.onNetworkError?.(message);
    void this.stop();
  }

  private async reply(chatId: number, text: string): Promise<void> {
    await this.bot?.sendMessage(chatId, text);
  }

  private logHandlerError(error: unknown): void {
    console.error("[TelegramBot] handler error:", error);
  }
}

function helpText(): string {
  return [
    "Команды:",
    "/start — оставить заявку",
    "/cancel — отменить текущую заявку",
    "/help — эта справка"
  ].join("\n");
}

function isValidPhone(text: string): boolean {
  const digits = text.replace(/\D/g, "");
  return digits.length >= 10;
}

function isNetworkError(message: string): boolean {
  return /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ECONNRESET|EFATAL|socket hang up/i.test(message);
}

function buildProxyFromConfig(config: AppConfig): string | null {
  if (!config.proxyEnabled) {
    return null;
  }
  const host = config.proxyHost?.trim();
  const port = Number(config.proxyPort || 0);
  if (!host || !port) {
    return null;
  }

  const username = config.proxyUsername?.trim();
  const password = config.proxyPassword?.trim();
  if (username && password) {
    return `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
  }

  return `http://${host}:${port}`;
}
