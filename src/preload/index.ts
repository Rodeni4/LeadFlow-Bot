import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig, Lead, ServiceStatus } from "../shared/types";

type Unsubscribe = () => void;

const api = {
  getConfig: (): Promise<AppConfig | null> => ipcRenderer.invoke("config:get"),
  saveConfig: (config: AppConfig): Promise<AppConfig | null> => ipcRenderer.invoke("config:set", config),
  getStatus: (): Promise<ServiceStatus> => ipcRenderer.invoke("services:get-status"),
  startBot: (): Promise<ServiceStatus> => ipcRenderer.invoke("services:start-bot"),
  stopBot: (): Promise<ServiceStatus> => ipcRenderer.invoke("services:stop-bot"),
  startWebsite: (): Promise<ServiceStatus> => ipcRenderer.invoke("services:start-website"),
  stopWebsite: (): Promise<ServiceStatus> => ipcRenderer.invoke("services:stop-website"),
  getLeads: (): Promise<Lead[]> => ipcRenderer.invoke("leads:get"),
  getProxyIp: (): Promise<{ ip: string; viaProxy: boolean; error?: string }> =>
    ipcRenderer.invoke("proxy:get-ip"),
  onLeadsUpdated: (callback: (leads: Lead[]) => void): Unsubscribe => {
    const handler = (_event: unknown, leads: Lead[]) => callback(leads);
    ipcRenderer.on("leads:updated", handler);
    return () => ipcRenderer.off("leads:updated", handler);
  },
  onStatusUpdated: (callback: (status: ServiceStatus) => void): Unsubscribe => {
    const handler = (_event: unknown, status: ServiceStatus) => callback(status);
    ipcRenderer.on("status:updated", handler);
    return () => ipcRenderer.off("status:updated", handler);
  },
  onBotError: (callback: (message: string) => void): Unsubscribe => {
    const handler = (_event: unknown, message: string) => callback(message);
    ipcRenderer.on("bot:error", handler);
    return () => ipcRenderer.off("bot:error", handler);
  }
};

contextBridge.exposeInMainWorld("leadflowApi", api);
