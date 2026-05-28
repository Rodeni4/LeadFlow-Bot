# LeadFlow Bot

Electron desktop app that controls:
- Telegram bot lead intake,
- local website lead intake (`http://localhost:3000`),
- Google Sheets persistence,
- lead list view inside Electron.

## Features
- Start/stop Telegram bot from desktop UI.
- Start/stop website from desktop UI.
- Receive leads from Telegram and web form.
- Save each lead to Google Sheets.
- View recent leads in Electron app.

## Tech stack
- Electron + TypeScript
- React + Vite (renderer UI)
- Express (local website/API)
- node-telegram-bot-api
- Google Sheets API (`googleapis`)

## Setup
1. Install dependencies:
   - `npm install`
2. Create `.env` from `.env.example` and fill values.
3. Share your Google Sheet with service account email as Editor.

## Run
- Development mode:
  - `npm run dev`
- Production build:
  - `npm run build`
- Run built app:
  - `npm run start`

## Google Sheets columns
Default range: `Leads!A:F`
1. Lead ID
2. Source (`telegram` or `website`)
3. Name
4. Phone
5. Message
6. Created At (ISO timestamp)

## Telegram flow
- `/start` - starts lead form flow.
- `/help` - show commands.
- `/cancel` - cancel current flow.

## Notes
- If `GOOGLE_SERVICE_ACCOUNT_JSON` is invalid, app will fail at startup.
- Website can also accept POST JSON on `/api/leads`.
