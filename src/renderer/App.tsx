import { useEffect, useMemo, useRef, useState } from "react";
import type { AppConfig, Lead, ServiceStatus } from "../shared/types";

const defaultStatus: ServiceStatus = { bot: "stopped", website: "stopped" };
const defaultConfig: AppConfig = {
  telegramBotToken: "",
  googleSheetsId: "",
  googleSheetsRange: "Leads!A:F",
  googleServiceAccountJson: "",
  port: 3000,
  proxyHost: "",
  proxyPort: 0,
  proxyUsername: "",
  proxyPassword: "",
  proxyEnabled: false
};

export function App() {
  const [status, setStatus] = useState<ServiceStatus>(defaultStatus);
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeView, setActiveView] = useState<"recent-leads" | "auth-telegram" | "auth-google" | "proxy">("recent-leads");
  const [tokenPersisted, setTokenPersisted] = useState(false);
  const [sheetsPersisted, setSheetsPersisted] = useState(false);
  const [proxyIp, setProxyIp] = useState("...");
  const [ipViaProxy, setIpViaProxy] = useState(false);
  const skipAutoSave = useRef(true);
  const configLoaded = useRef(false);

  useEffect(() => {
    const api = window.leadflowApi;
    if (!api) {
      setError("Запустите приложение через npm run dev (окно Electron, не браузер).");
      return;
    }

    api
      .getConfig()
      .then((saved) => {
        if (saved) {
          setConfig(saved);
          setTokenPersisted(Boolean(saved.telegramBotToken.trim()));
          setSheetsPersisted(
            Boolean(saved.googleSheetsId.trim() && saved.googleServiceAccountJson.trim())
          );
          setInfo("Настройки загружены.");
        }
        configLoaded.current = true;
        skipAutoSave.current = false;
      })
      .catch((err) => reportError(err, setError));

    api.getStatus().then(setStatus).catch((err) => reportError(err, setError));
    api.getLeads().then(setLeads).catch((err) => reportError(err, setError));

    const unsubLeads = api.onLeadsUpdated(setLeads);
    const unsubStatus = api.onStatusUpdated(setStatus);
    const unsubBotError = api.onBotError((message) => {
      setError(message);
      setInfo("");
    });
    return () => {
      unsubLeads();
      unsubStatus();
      unsubBotError();
    };
  }, []);

  useEffect(() => {
    if (skipAutoSave.current || !configLoaded.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const payload: AppConfig = {
        ...config,
        port: Number(config.port || 3000)
      };
      if (!payload.telegramBotToken.trim()) {
        return;
      }

      void window.leadflowApi
        ?.saveConfig(payload)
        .then(() => setTokenPersisted(true))
        .catch((err) => reportError(err, setError));
    }, 600);

    return () => window.clearTimeout(timer);
  }, [config]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshProxyIp();
    }, 30_000);
    void refreshProxyIp();
    return () => window.clearInterval(interval);
  }, [config.proxyHost, config.proxyPort, config.proxyUsername, config.proxyPassword, config.proxyEnabled]);

  async function saveConfig(): Promise<void> {
    try {
      setError("");
      setInfo("");
      const payload: AppConfig = {
        ...config,
        port: Number(config.port || 3000)
      };
      await window.leadflowApi.saveConfig(payload);
      setTokenPersisted(Boolean(payload.telegramBotToken.trim()));
      const hasSheets = Boolean(payload.googleSheetsId.trim() && payload.googleServiceAccountJson.trim());
      setInfo(
        hasSheets
          ? "Настройки сохранены."
          : "Токен Telegram сохранён. Google Sheets можно добавить позже."
      );
    } catch (err) {
      reportError(err, setError);
    }
  }

  async function saveGoogleSheetsConfig(): Promise<void> {
    try {
      setError("");
      setInfo("");
      if (!config.telegramBotToken.trim()) {
        setError("Сначала сохраните Telegram Bot Token.");
        return;
      }

      const payload: AppConfig = {
        ...config,
        port: Number(config.port || 3000),
        googleSheetsRange: config.googleSheetsRange.trim() || "Leads!A:F"
      };

      if (!payload.googleSheetsId.trim() || !payload.googleServiceAccountJson.trim()) {
        setError("Укажите Google Sheets ID и Service Account JSON.");
        return;
      }

      const test = await window.leadflowApi.testGoogleSheets(payload);
      if (!test.ok) {
        setError(test.error);
        return;
      }

      setConfig(payload);
      await window.leadflowApi.saveConfig(payload);
      setSheetsPersisted(true);
      setInfo(
        `Google Sheets подключён: «${test.title}». Новые лиды попадут в диапазон ${payload.googleSheetsRange}.`
      );
    } catch (err) {
      reportError(err, setError);
    }
  }

  async function saveProxyConfig(): Promise<void> {
    try {
      setError("");
      setInfo("");
      const payload: AppConfig = {
        ...config,
        port: Number(config.port || 3000),
        proxyPort: Number(config.proxyPort || 0),
        proxyEnabled: true
      };
      setConfig(payload);
      await window.leadflowApi.saveConfig(payload);
      setInfo("Proxy settings saved.");
      await refreshProxyIp();
    } catch (err) {
      reportError(err, setError);
    }
  }

  async function clearProxyConfig(): Promise<void> {
    try {
      setError("");
      setInfo("");
      const payload: AppConfig = {
        ...config,
        proxyHost: "",
        proxyPort: 0,
        proxyUsername: "",
        proxyPassword: "",
        proxyEnabled: false,
        port: Number(config.port || 3000)
      };
      setConfig(payload);
      await window.leadflowApi.saveConfig(payload);
      setInfo("Proxy settings cleared.");
      await refreshProxyIp();
    } catch (err) {
      reportError(err, setError);
    }
  }

  const hasProxySettings = Boolean(config.proxyHost.trim() && config.proxyPort);

  async function toggleProxy(): Promise<void> {
    if (!hasProxySettings) {
      setError("Сначала укажите Host и Port на вкладке Proxy и нажмите Save Proxy.");
      return;
    }
    try {
      setError("");
      setInfo("");
      const payload: AppConfig = {
        ...config,
        proxyEnabled: !config.proxyEnabled,
        port: Number(config.port || 3000)
      };
      setConfig(payload);
      await window.leadflowApi.saveConfig(payload);
      setInfo(payload.proxyEnabled ? "Прокси включён." : "Прокси выключен.");
      await refreshProxyIp();
    } catch (err) {
      reportError(err, setError);
    }
  }

  async function refreshProxyIp(): Promise<void> {
    try {
      const result = await window.leadflowApi.getProxyIp();
      setProxyIp(result.ip);
      setIpViaProxy(result.viaProxy);
      if (result.error && activeView === "proxy") {
        setError(result.error);
      }
    } catch {
      setProxyIp("недоступен");
      setIpViaProxy(false);
    }
  }

  async function clearLeadsTable(): Promise<void> {
    if (leads.length === 0) {
      return;
    }
    const hasSheets = Boolean(config.googleSheetsId.trim() && config.googleServiceAccountJson.trim());
    const confirmText = hasSheets
      ? "Очистить заявки в приложении и в Google Sheets? Строка заголовков в таблице сохранится."
      : "Очистить список заявок в приложении?";
    if (!window.confirm(confirmText)) {
      return;
    }
    try {
      setError("");
      setInfo("");
      const result = await window.leadflowApi.clearLeads();
      setLeads(result.leads);
      setInfo(
        result.sheetsCleared
          ? "Список заявок и Google Sheets очищены."
          : "Список заявок очищен."
      );
    } catch (err) {
      reportError(err, setError);
    }
  }

  async function ensureConfigSaved(): Promise<void> {
    const payload: AppConfig = {
      ...config,
      port: Number(config.port || 3000)
    };
    if (!payload.telegramBotToken.trim()) {
      throw new Error("Введите Telegram Bot Token и нажмите Save Authorization.");
    }

    const saved = await window.leadflowApi.getConfig();
    if (saved && configMatches(saved, payload)) {
      return;
    }

    if (status.bot === "running" || status.website === "running") {
      throw new Error("Выключите бота и сайт перед сменой настроек.");
    }

    await window.leadflowApi.saveConfig(payload);
  }

  async function toggleBot(): Promise<void> {
    try {
      setError("");
      setInfo("");
      if (status.bot !== "running") {
        await ensureConfigSaved();
      }
      const next = status.bot === "running"
        ? await window.leadflowApi.stopBot()
        : await window.leadflowApi.startBot();
      setStatus(next);
      if (next.bot === "running") {
        setInfo("Telegram Bot запущен.");
      } else if (next.bot === "stopped") {
        setInfo("Telegram Bot остановлен.");
      }
    } catch (err) {
      reportError(err, setError);
    }
  }

  async function toggleWebsite(): Promise<void> {
    try {
      setError("");
      setInfo("");
      if (status.website !== "running") {
        await ensureConfigSaved();
      }
      const next = status.website === "running"
        ? await window.leadflowApi.stopWebsite()
        : await window.leadflowApi.startWebsite();
      setStatus(next);
      if (next.website === "running") {
        setInfo("Сайт запущен.");
      } else if (next.website === "stopped") {
        setInfo("Сайт остановлен.");
      }
    } catch (err) {
      reportError(err, setError);
    }
  }

  const websiteUrl = useMemo(() => `http://localhost:${config.port || 3000}`, [config.port]);

  const serviceAccountEmail = useMemo(() => {
    try {
      const parsed = JSON.parse(config.googleServiceAccountJson.trim()) as { client_email?: string };
      return parsed.client_email?.trim() ?? "";
    } catch {
      return "";
    }
  }, [config.googleServiceAccountJson]);

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
          <button
            className={`menuItem ${activeView === "proxy" ? "active" : ""}`}
            onClick={() => setActiveView("proxy")}
          >
            Proxy
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
                    className={`switch ${status.bot === "running" ? "on" : ""} ${status.bot === "error" ? "error" : ""}`}
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
              <div className="controlGroup">
                <div className="switchLine">
                  <span className="switchName">Proxy</span>
                  <button
                    className={`switch ${config.proxyEnabled ? "on" : ""} ${!hasProxySettings ? "disabled" : ""}`}
                    onClick={() => void toggleProxy()}
                    disabled={!hasProxySettings}
                    aria-label="Toggle proxy"
                    title={
                      hasProxySettings
                        ? config.proxyEnabled
                          ? "Прокси включён — Telegram и IP через прокси"
                          : "Прокси выключен — прямое подключение"
                        : "Сначала сохраните настройки прокси"
                    }
                  >
                    <span className="switchKnob" />
                  </button>
                </div>
              </div>
              <div className="controlGroup ipGroup" title={ipViaProxy ? "IP через прокси" : "IP без прокси (прямое подключение)"}>
                <span className="switchName">IP</span>
                <span className="ipValue">{proxyIp}</span>
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
              {!error && !info && (activeView === "auth-google" || activeView === "proxy") ? (
                <div className="noticeBox info muted">
                  <span className="noticeIcon">i</span>
                  <span>
                    {activeView === "auth-google"
                      ? "Дайте таблице доступ для email Service Account (Редактор), затем Save Authorization."
                      : "Заполните прокси и сохраните. IP обновляется каждые 30 секунд."}
                  </span>
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
                  <th>Comment</th>
                  <th>Telegram</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.source}</td>
                    <td>{lead.name}</td>
                    <td>{lead.phone}</td>
                    <td>{lead.message}</td>
                    <td>{lead.source === "telegram" ? lead.telegram || "—" : ""}</td>
                    <td>{new Date(lead.createdAt).toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="leadsTableFooter">
              <button
                type="button"
                className="clearLeadsButton"
                onClick={() => void clearLeadsTable()}
                disabled={leads.length === 0}
              >
                Очистить таблицу
              </button>
            </div>
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
                    onChange={(event) => {
                      setTokenPersisted(false);
                      setConfig({ ...config, telegramBotToken: event.target.value });
                    }}
                    placeholder="123456:ABC-DEF..."
                  />
                  {tokenPersisted && config.telegramBotToken.trim() ? (
                    <span className="fieldHint">Токен сохранён на этом компьютере.</span>
                  ) : null}
                </label>
              </div>
              <button className="primaryButton panelSaveButton" onClick={saveConfig}>
                Save Authorization
              </button>
            </div>
          </section>
        ) : activeView === "auth-google" ? (
          <section className="card panelCard">
            <h2>Google Sheets</h2>
            <div className="panelFormRow">
              <div className="fields">
                <label>
                  Google Sheets ID
                  <input
                    value={config.googleSheetsId}
                    onChange={(event) => {
                      setSheetsPersisted(false);
                      setConfig({ ...config, googleSheetsId: event.target.value });
                    }}
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
                    onChange={(event) => {
                      setSheetsPersisted(false);
                      setConfig({ ...config, googleServiceAccountJson: event.target.value });
                    }}
                    placeholder='{"type":"service_account",...}'
                    rows={9}
                  />
                  {serviceAccountEmail ? (
                    <span className="fieldHint">
                      Доступ к таблице для: {serviceAccountEmail}
                    </span>
                  ) : null}
                </label>
              </div>
              <button className="primaryButton panelSaveButton" onClick={saveGoogleSheetsConfig}>
                Save Authorization
              </button>
              {sheetsPersisted ? (
                <span className="fieldHint panelSaveHint">Google Sheets сохранён и проверен.</span>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="card panelCard">
            <h2>Proxy</h2>
            <div className="panelFormRow">
              <div className="fields">
                <label>
                  Proxy Host
                  <input
                    value={config.proxyHost}
                    onChange={(event) => setConfig({ ...config, proxyHost: event.target.value })}
                    placeholder="64.7.248.96"
                  />
                </label>
                <label>
                  Proxy Port
                  <input
                    type="number"
                    value={config.proxyPort || ""}
                    onChange={(event) => setConfig({ ...config, proxyPort: Number(event.target.value) })}
                    placeholder="47098"
                  />
                </label>
                <label>
                  Proxy Username
                  <input
                    value={config.proxyUsername}
                    onChange={(event) => setConfig({ ...config, proxyUsername: event.target.value })}
                    placeholder="username"
                  />
                </label>
                <label>
                  Proxy Password
                  <input
                    type="password"
                    value={config.proxyPassword}
                    onChange={(event) => setConfig({ ...config, proxyPassword: event.target.value })}
                    placeholder="password"
                  />
                </label>
              </div>
              <div className="proxyButtons">
                <button className="primaryButton panelSaveButton" onClick={saveProxyConfig}>
                  Save Proxy
                </button>
                <button className="panelSaveButton" onClick={clearProxyConfig}>
                  Delete Proxy
                </button>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function configMatches(a: AppConfig, b: AppConfig): boolean {
  return (
    a.telegramBotToken === b.telegramBotToken &&
    a.googleSheetsId === b.googleSheetsId &&
    a.googleSheetsRange === b.googleSheetsRange &&
    a.googleServiceAccountJson === b.googleServiceAccountJson &&
    a.port === b.port &&
    a.proxyHost === b.proxyHost &&
    a.proxyPort === b.proxyPort &&
    a.proxyUsername === b.proxyUsername &&
    a.proxyPassword === b.proxyPassword &&
    a.proxyEnabled === b.proxyEnabled
  );
}

function reportError(error: unknown, setError: (value: string) => void): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  setError(message);
  console.error(error);
}
