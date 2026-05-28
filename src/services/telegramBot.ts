import TelegramBot from "node-telegram-bot-api";
import type { AppConfig } from "../shared/types";

const START_COMMAND = /^\/start(?:@\w+)?(?:\s+.*)?$/i;

export interface TelegramBotHooks {
  onNetworkError?: (message: string) => void;
}

export class TelegramBotService {
  private bot: TelegramBot | null = null;
  private networkErrorHandled = false;

  constructor(
    private readonly config: AppConfig,
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

    const proxy = process.env.TELEGRAM_PROXY?.trim() || process.env.HTTPS_PROXY?.trim();

    this.bot = new TelegramBot(token, {
      polling: true,
      ...(proxy ? { request: { proxy } as NonNullable<TelegramBot.ConstructorOptions["request"]> } : {})
    });
    this.registerHandlers();

    void this.bot
      .getMe()
      .then((me) => console.log(`[TelegramBot] echo mode, connected as @${me.username ?? me.id}`))
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
      void this.reply(
        msg.chat.id,
        "Echo-режим.\n\nОтправьте любой текст — бот повторит его.\nПозже подключим приём заявок."
      ).catch((err) => this.logHandlerError(err));
    });

    this.bot.on("message", (msg) => {
      const text = msg.text?.trim();
      if (!text || text.startsWith("/")) {
        return;
      }
      void this.reply(msg.chat.id, `Echo: ${text}`).catch((err) => this.logHandlerError(err));
    });
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

function isNetworkError(message: string): boolean {
  return /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ECONNRESET|EFATAL|socket hang up/i.test(message);
}
