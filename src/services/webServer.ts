import express, { type Express } from "express";
import type { AppConfig } from "../shared/types";
import type { LeadsService } from "./leadsService";
import { renderLeadFormPage } from "./webFormPage";

export class WebServerService {
  private app: Express;
  private server: ReturnType<Express["listen"]> | null = null;
  private readonly port: number;

  constructor(private readonly leadsService: LeadsService, config: AppConfig) {
    this.port = Number(config.port ?? 3000);
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
    this.mountRoutes();
  }

  start(): Promise<void> {
    if (this.server) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => resolve());
      this.server.on("error", reject);
    });
  }

  stop(): Promise<void> {
    if (!this.server) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        this.server = null;
        resolve();
      });
    });
  }

  private mountRoutes(): void {
    this.app.get("/", (_req, res) => {
      res.type("html").send(renderLeadFormPage());
    });

    this.app.post("/api/leads", async (req, res) => {
      try {
        const lead = await this.leadsService.createLead({
          source: "website",
          name: String(req.body.name ?? ""),
          phone: String(req.body.phone ?? ""),
          message: String(req.body.message ?? "")
        });
        res.json({ ok: true, lead });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(400).json({ ok: false, error: message });
      }
    });
  }
}
