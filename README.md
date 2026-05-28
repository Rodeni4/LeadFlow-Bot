# LeadFlow Bot

Desktop app (Electron) for collecting leads from **Telegram** and a **local website**, storing them locally and syncing to **Google Sheets**.

## Features

- **Telegram bot** — step-by-step lead form (`/start`, `/help`, `/cancel`)
- **Local website** — form at `http://localhost:3000` + `POST /api/leads`
- **Google Sheets** — append each lead; connection test on save
- **Proxy** — HTTP proxy for Telegram API + public IP check in the top bar
- **Recent leads** — table in the app; clear local list and Google Sheet data (headers stay)
- **Persistence** — token, proxy, and Google settings saved to disk between restarts

## Tech stack

- Electron + TypeScript
- React + Vite (UI)
- Express (local web server)
- node-telegram-bot-api
- Google Sheets API (`googleapis`)

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in values (optional — settings can be saved in the UI).
3. Run in development:
   ```bash
   npm run dev
   ```
   Electron restarts automatically when the main process is rebuilt (`nodemon`).

4. In the app:
   - **Authorization Telegram** — paste bot token → Save
   - **Google Sheets ID** — spreadsheet ID, range, Service Account JSON → Save (table is verified before save)
   - **Proxy** (optional) — host, port, credentials → Save; toggle in the top bar
   - Turn on **Start Bot** / **Start Website**

## Google Sheets setup

1. Create a spreadsheet with sheet **Leads** and headers in row 1:

   | Date | Source | Full Name | Phone | Email | Telegram |
   |------|--------|-----------|-------|-------|----------|

2. Google Cloud → Service Account → download JSON key.
3. Share the spreadsheet with `client_email` from JSON as **Editor**.
4. In the app, enter Spreadsheet ID, range `Leads!A:F`, and paste the JSON.

### Column mapping

| Column | Content |
|--------|---------|
| **Date** | `DD.MM.YYYY HH:mm` (text, local time) |
| **Source** | `telegram` or `website` |
| **Full Name** | Name from the form |
| **Phone** | Phone number |
| **Email** | Comment / message |
| **Telegram** | `@username` or `id:123` for Telegram; empty for website |

## Telegram commands

- `/start` — start lead form (name → phone → comment)
- `/cancel` — cancel current form
- `/help` — show commands

## Build & run

```bash
npm run build   # compile main + renderer
npm run start   # run production build
```

## Environment variables

See `.env.example`. All settings can also be configured in the UI and are stored in:

- Windows: `%APPDATA%\leadflow-bot\`
- macOS: `~/Library/Application Support/leadflow-bot/`
- Linux: `~/.config/leadflow-bot/`

## Notes

- Google Sheets is **optional** — bot and website work with Telegram token only.
- If Telegram API is blocked, enable **Proxy** in the app or set `TELEGRAM_PROXY` in `.env`.
- **Clear table** removes data rows from the app and Google Sheet (row 1 headers are kept).
- Screenshots are not required for setup; add them to `docs/` later if you want a visual GitHub README.

## License

MIT
