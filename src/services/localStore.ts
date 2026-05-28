import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import type { Lead } from "../shared/types";

const MAX_LEADS = 200;

export class LocalStore extends EventEmitter {
  private leads: Lead[] = [];
  private readonly persistenceFile: string | null;

  constructor(persistenceFile?: string) {
    super();
    this.persistenceFile = persistenceFile ?? null;
    if (this.persistenceFile) {
      this.leads = this.loadFromDisk();
    }
  }

  addLead(lead: Lead): void {
    this.leads.unshift(lead);
    if (this.leads.length > MAX_LEADS) {
      this.leads.length = MAX_LEADS;
    }
    this.persist();
    this.emit("leadAdded", lead);
  }

  getLeads(): Lead[] {
    return [...this.leads];
  }

  private loadFromDisk(): Lead[] {
    if (!this.persistenceFile) {
      return [];
    }

    try {
      if (!fs.existsSync(this.persistenceFile)) {
        return [];
      }
      const raw = fs.readFileSync(this.persistenceFile, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(isLead).slice(0, MAX_LEADS);
    } catch (error) {
      console.warn("[LocalStore] failed to load leads:", error);
      return [];
    }
  }

  private persist(): void {
    if (!this.persistenceFile) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(this.persistenceFile), { recursive: true });
      fs.writeFileSync(this.persistenceFile, JSON.stringify(this.leads, null, 2), "utf8");
    } catch (error) {
      console.error("[LocalStore] failed to save leads:", error);
    }
  }
}

function isLead(value: unknown): value is Lead {
  if (!value || typeof value !== "object") {
    return false;
  }
  const lead = value as Lead;
  return (
    typeof lead.id === "string" &&
    (lead.source === "telegram" || lead.source === "website") &&
    typeof lead.name === "string" &&
    typeof lead.phone === "string" &&
    typeof lead.message === "string" &&
    typeof lead.createdAt === "string"
  );
}
