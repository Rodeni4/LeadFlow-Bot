import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import dotenv from "dotenv";
import type { AppConfig } from "../shared/types";
import { loadPersistedConfig, mergeConfigFromEnv, normalizeConfig, savePersistedConfig } from "./configStore";
import { AppOrchestrator } from "./orchestrator";

dotenv.config();

process.on("unhandledRejection", (reason) => {
  console.error("[LeadFlow] unhandledRejection:", reason);
});

let orchestrator: AppOrchestrator | null = null;
let mainWindow: BrowserWindow | null = null;

function sendToRenderer(channel: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const contents = mainWindow.webContents;
  if (contents.isDestroyed()) {
    return;
  }
  contents.send(channel, payload);
}

function getOrchestrator(): AppOrchestrator {
  if (!orchestrator) {
    throw new Error("App is not ready yet.");
  }
  return orchestrator;
}

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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.NODE_ENV === "development") {
    void mainWindow.loadURL("http://localhost:5173");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle("config:get", () => {
    const disk = loadPersistedConfig();
    const memory = getOrchestrator().getConfig();
    if (!disk) {
      return memory ? normalizeConfig(memory) : null;
    }
    if (!memory) {
      return disk;
    }
    return normalizeConfig(mergeConfigFromEnv({ ...disk, ...memory }) ?? disk);
  });
  ipcMain.handle("config:set", (_event, config: AppConfig) => {
    savePersistedConfig(config);
    getOrchestrator().syncConfig(config);
    sendToRenderer("status:updated", getOrchestrator().getStatus());
    return loadPersistedConfig() ?? getOrchestrator().getConfig();
  });
  ipcMain.handle("services:get-status", () => getOrchestrator().getStatus());
  ipcMain.handle("services:start-bot", async () => {
    await getOrchestrator().startBot();
    sendToRenderer("status:updated", getOrchestrator().getStatus());
    return getOrchestrator().getStatus();
  });
  ipcMain.handle("services:stop-bot", async () => {
    await getOrchestrator().stopBot();
    sendToRenderer("status:updated", getOrchestrator().getStatus());
    return getOrchestrator().getStatus();
  });
  ipcMain.handle("services:start-website", async () => {
    await getOrchestrator().startWebsite();
    sendToRenderer("status:updated", getOrchestrator().getStatus());
    return getOrchestrator().getStatus();
  });
  ipcMain.handle("services:stop-website", async () => {
    await getOrchestrator().stopWebsite();
    sendToRenderer("status:updated", getOrchestrator().getStatus());
    return getOrchestrator().getStatus();
  });
  ipcMain.handle("leads:get", () => getOrchestrator().getLeads());
}

app.whenReady().then(() => {
  const initialConfig = mergeConfigFromEnv(loadPersistedConfig());
  const leadsFile = path.join(app.getPath("userData"), "leads.json");
  orchestrator = new AppOrchestrator(initialConfig, leadsFile);
  if (initialConfig) {
    console.log("[LeadFlow] config loaded from disk or .env");
  }

  registerIpc();
  orchestrator.setStatusListener((status, botError) => {
    sendToRenderer("status:updated", status);
    if (botError) {
      sendToRenderer("bot:error", botError);
    }
  });
  orchestrator.onLeadAdded(() => {
    sendToRenderer("leads:updated", getOrchestrator().getLeads());
  });
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", async () => {
  await orchestrator?.shutdown();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
