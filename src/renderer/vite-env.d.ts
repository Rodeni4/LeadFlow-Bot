/// <reference types="vite/client" />

import type { AppConfig, Lead, ServiceStatus } from "../shared/types";

interface LeadflowApi {
  getConfig: () => Promise<AppConfig | null>;
  saveConfig: (config: AppConfig) => Promise<AppConfig | null>;
  getStatus: () => Promise<ServiceStatus>;
  startBot: () => Promise<ServiceStatus>;
  stopBot: () => Promise<ServiceStatus>;
  startWebsite: () => Promise<ServiceStatus>;
  stopWebsite: () => Promise<ServiceStatus>;
  getLeads: () => Promise<Lead[]>;
  getProxyIp: () => Promise<{ ip: string; viaProxy: boolean; error?: string }>;
  onLeadsUpdated: (callback: (leads: Lead[]) => void) => () => void;
  onStatusUpdated: (callback: (status: ServiceStatus) => void) => () => void;
  onBotError: (callback: (message: string) => void) => () => void;
}

declare global {
  interface Window {
    leadflowApi: LeadflowApi;
  }
}
