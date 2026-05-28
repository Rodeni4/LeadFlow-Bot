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
  ipcMain.handle("config:set", async (_event, config: AppConfig) => {
    savePersistedConfig(config);
    await getOrchestrator().syncConfig(config);
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
  ipcMain.handle("proxy:get-ip", async () => {
    try {
      const config = getOrchestrator().getConfig();
      const proxy = buildProxyFromConfig(config);
      const ip = await fetchPublicIp(proxy);
      return { ip, viaProxy: Boolean(proxy) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "IP check failed";
      console.error("[LeadFlow] proxy:get-ip:", message);
      return { ip: "недоступен", viaProxy: false, error: message };
    }
  });
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

async function fetchPublicIp(proxy: string | null): Promise<string> {
  const url = "https://api.ipify.org?format=json";
  const signal = AbortSignal.timeout(20_000);

  if (!proxy) {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Direct IP check failed (${response.status})`);
    }
    const data = (await response.json()) as { ip?: string };
    if (!data.ip) {
      throw new Error("Direct IP response is empty");
    }
    return data.ip;
  }

  const { ProxyAgent, fetch: undiciFetch } = await import("undici");
  const agent = new ProxyAgent(proxy);
  const response = await undiciFetch(url, { dispatcher: agent, signal });
  if (!response.ok) {
    throw new Error(`Proxy IP check failed (${response.status})`);
  }
  const data = (await response.json()) as { ip?: string };
  if (!data.ip) {
    throw new Error("Proxy IP response is empty");
  }
  return data.ip;
}

function buildProxyFromConfig(config: AppConfig | null): string | null {
  if (!config || !config.proxyEnabled) {
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
