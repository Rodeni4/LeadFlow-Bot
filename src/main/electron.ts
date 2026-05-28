import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import dotenv from "dotenv";
import type { AppConfig } from "../shared/types";
import { AppOrchestrator } from "./orchestrator";

dotenv.config();

const orchestrator = new AppOrchestrator(getInitialConfigFromEnv());
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === "development") {
    void mainWindow.loadURL("http://localhost:5173");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle("config:get", () => orchestrator.getConfig());
  ipcMain.handle("config:set", (_event, config: AppConfig) => {
    orchestrator.setConfig(config);
    mainWindow?.webContents.send("status:updated", orchestrator.getStatus());
    return orchestrator.getConfig();
  });
  ipcMain.handle("services:get-status", () => orchestrator.getStatus());
  ipcMain.handle("services:start-bot", () => {
    orchestrator.startBot();
    mainWindow?.webContents.send("status:updated", orchestrator.getStatus());
    return orchestrator.getStatus();
  });
  ipcMain.handle("services:stop-bot", async () => {
    await orchestrator.stopBot();
    mainWindow?.webContents.send("status:updated", orchestrator.getStatus());
    return orchestrator.getStatus();
  });
  ipcMain.handle("services:start-website", async () => {
    await orchestrator.startWebsite();
    mainWindow?.webContents.send("status:updated", orchestrator.getStatus());
    return orchestrator.getStatus();
  });
  ipcMain.handle("services:stop-website", async () => {
    await orchestrator.stopWebsite();
    mainWindow?.webContents.send("status:updated", orchestrator.getStatus());
    return orchestrator.getStatus();
  });
  ipcMain.handle("leads:get", () => orchestrator.getLeads());
}

app.whenReady().then(() => {
  registerIpc();
  orchestrator.onLeadAdded(() => {
    mainWindow?.webContents.send("leads:updated", orchestrator.getLeads());
  });
  createWindow();
});

app.on("window-all-closed", async () => {
  await orchestrator.shutdown();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function getInitialConfigFromEnv(): AppConfig | null {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const googleSheetsId = process.env.GOOGLE_SHEETS_ID?.trim() ?? "";
  const googleServiceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ?? "";
  if (!telegramBotToken || !googleSheetsId || !googleServiceAccountJson) {
    return null;
  }
  return {
    telegramBotToken,
    googleSheetsId,
    googleSheetsRange: process.env.GOOGLE_SHEETS_RANGE?.trim() || "Leads!A:F",
    googleServiceAccountJson,
    port: Number(process.env.PORT ?? 3000)
  };
}
