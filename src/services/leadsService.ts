import crypto from "node:crypto";
import type { CreateLeadInput, Lead } from "../shared/types";
import { GoogleSheetsService } from "./googleSheets";
import { LocalStore } from "./localStore";

export class LeadsService {
  constructor(
    private readonly localStore: LocalStore,
    private readonly sheetsService: GoogleSheetsService | null
  ) {}

  async createLead(input: CreateLeadInput): Promise<Lead> {
    const name = input.name.trim();
    const phone = input.phone.trim();
    const message = input.message.trim();

    if (!name || !phone) {
      throw new Error("Name and phone are required.");
    }

    const lead: Lead = {
      id: crypto.randomUUID(),
      source: input.source,
      name,
      phone,
      message,
      createdAt: new Date().toISOString(),
      ...(input.telegram?.trim() ? { telegram: input.telegram.trim() } : {})
    };

    this.localStore.addLead(lead);
    if (this.sheetsService) {
      try {
        await this.sheetsService.appendLead(lead);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[LeadsService] Google Sheets append failed:", message);
      }
    }
    return lead;
  }

  getRecentLeads(): Lead[] {
    return this.localStore.getLeads();
  }

  async clearAll(): Promise<boolean> {
    let sheetsCleared = false;
    if (this.sheetsService) {
      await this.sheetsService.clearLeadRows();
      sheetsCleared = true;
    }
    this.localStore.clearLeads();
    return sheetsCleared;
  }
}
