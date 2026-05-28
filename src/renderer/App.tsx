import { useEffect, useMemo, useState } from "react";
import type { AppConfig, Lead, ServiceStatus } from "../shared/types";

const defaultStatus: ServiceStatus = { bot: "stopped", website: "stopped" };
const defaultConfig: AppConfig = {
  telegramBotToken: "",
  googleSheetsId: "",
  googleSheetsRange: "Leads!A:F",
  googleServiceAccountJson: "",
  port: 3000
};

export function App() {
  const [status, setStatus] = useState<ServiceStatus>(defaultStatus);
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeView, setActiveView] = useState<"recent-leads" | "auth-telegram" | "auth-google">("recent-leads");

  useEffect(() => {
    window.leadflowApi.getConfig().then((saved) => {
      if (saved) {
        setConfig(saved);
        setInfo("Config loaded.");
      }
    }).catch((err) => reportError(err, setError));
    window.leadflowApi.getStatus().then(setStatus).catch((err) => reportError(err, setError));
    window.leadflowApi.getLeads().then(setLeads).catch((err) => reportError(err, setError));

    const unsubLeads = window.leadflowApi.onLeadsUpdated(setLeads);
    const unsubStatus = window.leadflowApi.onStatusUpdated(setStatus);
    return () => {
      unsubLeads();
      unsubStatus();
    };
  }, []);

  async function saveConfig(): Promise<void> {
    try {
      setError("");
      setInfo("");
      const payload: AppConfig = {
        ...config,
        port: Number(config.port || 3000)
      };
      await window.leadflowApi.saveConfig(payload);
      setInfo("Authorization settings saved.");
    } catch (err) {
      reportError(err, setError);
    }
  }

  async function toggleBot(): Promise<void> {
    try {
      setError("");
      const next = status.bot === "running"
        ? await window.leadflowApi.stopBot()
        : await window.leadflowApi.startBot();
      setStatus(next);
    } catch (err) {
      reportError(err, setError);
    }
  }

  async function toggleWebsite(): Promise<void> {
    try {
      setError("");
      const next = status.website === "running"
        ? await window.leadflowApi.stopWebsite()
        : await window.leadflowApi.startWebsite();
      setStatus(next);
    } catch (err) {
      reportError(err, setError);
    }
  }

  const websiteUrl = useMemo(() => "http://localhost:3000", []);

  return (
    <main className={`appShell ${theme}`}>
      <aside className="sidebar">
        <div className="brand">LeadFlow</div>
        <nav className="menu">
          <button
            className={`menuItem ${activeView === "recent-leads" ? "active" : ""}`}
            onClick={() => setActiveView("recent-leads")}
          >
            Recent leads
          </button>
          <button
            className={`menuItem ${activeView === "auth-telegram" ? "active" : ""}`}
            onClick={() => setActiveView("auth-telegram")}
          >
            Authorization Telegram
          </button>
          <button
            className={`menuItem ${activeView === "auth-google" ? "active" : ""}`}
            onClick={() => setActiveView("auth-google")}
          >
            Google Sheets ID
          </button>
        </nav>
      </aside>

      <section className="content">
        <section className="topbar card">
          <div className="topbarRow">
            <div className="servicesInline">
              <div className="controlGroup">
                <div className="switchLine">
                  <span className="switchName">Start Bot</span>
                  <button
                    className={`switch ${status.bot === "running" ? "on" : ""}`}
                    onClick={toggleBot}
                    aria-label="Toggle bot"
                  >
                    <span className="switchKnob" />
                  </button>
                </div>
              </div>
              <div className="controlGroup">
                <div className="switchLine">
                  <span className="switchName">Start Website</span>
                  <button
                    className={`switch ${status.website === "running" ? "on" : ""}`}
                    onClick={toggleWebsite}
                    aria-label="Toggle website"
                  >
                    <span className="switchKnob" />
                  </button>
                </div>
              </div>
              <div className="controlGroup">
                <a href={websiteUrl} target="_blank" rel="noreferrer">
                  Open website
                </a>
              </div>
              <div className="controlGroup">
                <span className="switchName">Port</span>
                <input
                  className="portInput"
                  type="number"
                  value={config.port}
                  onChange={(event) => setConfig({ ...config, port: Number(event.target.value) })}
                />
              </div>
            </div>
            <button className="toggleTheme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <span className="themeIcon">{theme === "dark" ? "☀" : "☾"}</span>
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
          </div>

          {error || info || activeView === "auth-google" ? (
            <div className="noticeInline">
              {error ? (
                <div className="noticeBox error">
                  <span className="noticeIcon">!</span>
                  <span>{error}</span>
                </div>
              ) : null}
              {info ? (
                <div className="noticeBox info">
                  <span className="noticeIcon">i</span>
                  <span>{info}</span>
                </div>
              ) : null}
              {!error && !info && activeView === "auth-google" ? (
                <div className="noticeBox info muted">
                  <span className="noticeIcon">i</span>
                  <span>Fill in Google Sheets settings and save authorization to store leads.</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {activeView === "recent-leads" ? (
          <section className="card panelCard">
            <h2>Recent leads</h2>
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Message</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.source}</td>
                    <td>{lead.name}</td>
                    <td>{lead.phone}</td>
                    <td>{lead.message}</td>
                    <td>{new Date(lead.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : activeView === "auth-telegram" ? (
          <section className="card panelCard">
            <h2>Authorization Telegram</h2>
            <div className="panelFormRow">
              <div className="fields">
                <label>
                  Telegram Bot Token
                  <input
                    type="password"
                    value={config.telegramBotToken}
                    onChange={(event) => setConfig({ ...config, telegramBotToken: event.target.value })}
                    placeholder="123456:ABC-DEF..."
                  />
                </label>
              </div>
              <button className="primaryButton panelSaveButton" onClick={saveConfig}>
                Save Authorization
              </button>
            </div>
          </section>
        ) : (
          <section className="card panelCard">
            <h2>Google Sheets</h2>
            <div className="panelFormRow">
              <div className="fields">
                <label>
                  Google Sheets ID
                  <input
                    value={config.googleSheetsId}
                    onChange={(event) => setConfig({ ...config, googleSheetsId: event.target.value })}
                    placeholder="Spreadsheet ID"
                  />
                </label>
                <label>
                  Google Sheets Range
                  <input
                    value={config.googleSheetsRange}
                    onChange={(event) => setConfig({ ...config, googleSheetsRange: event.target.value })}
                    placeholder="Leads!A:F"
                  />
                </label>
                <label>
                  Google Service Account JSON
                  <textarea
                    value={config.googleServiceAccountJson}
                    onChange={(event) => setConfig({ ...config, googleServiceAccountJson: event.target.value })}
                    placeholder='{"type":"service_account",...}'
                    rows={9}
                  />
                </label>
              </div>
              <button className="primaryButton panelSaveButton" onClick={saveConfig}>
                Save Authorization
              </button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function reportError(error: unknown, setError: (value: string) => void): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  setError(message);
  console.error(error);
}
