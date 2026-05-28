import { EventEmitter } from "node:events";
import type { Lead } from "../shared/types";

export class LocalStore extends EventEmitter {
  private leads: Lead[] = [];

  addLead(lead: Lead): void {
    this.leads.unshift(lead);
    if (this.leads.length > 200) {
      this.leads.length = 200;
    }
    this.emit("leadAdded", lead);
  }

  getLeads(): Lead[] {
    return [...this.leads];
  }
}
