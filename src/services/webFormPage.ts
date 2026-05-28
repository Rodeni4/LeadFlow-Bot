export function renderLeadFormPage(): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LeadFlow — заявка</title>
    <style>
      :root {
        --bg: #060c1a;
        --card: #09162f;
        --text: #e8eeff;
        --muted: rgba(232, 238, 255, 0.72);
        --border: rgba(127, 155, 207, 0.25);
        --input-border: rgba(116, 147, 207, 0.45);
        --accent: #2b6cff;
        --accent-top: #2d7dff;
        --accent-bottom: #235de4;
        --success-bg: rgba(34, 197, 94, 0.14);
        --success-border: rgba(34, 197, 94, 0.45);
        --success-text: #86efac;
        --error-bg: rgba(237, 76, 103, 0.14);
        --error-border: rgba(237, 76, 103, 0.45);
        --error-text: #ff9ead;
        --radius: 14px;
        --field-radius: 9px;
        --gap: 14px;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
        background: var(--bg);
        color: var(--text);
        display: grid;
        place-items: center;
        padding: 24px 16px;
      }

      .shell {
        width: 100%;
        max-width: 520px;
      }

      .brand {
        font-size: 28px;
        font-weight: 800;
        color: var(--accent);
        margin: 0 0 16px;
      }

      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 28px 32px 24px;
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
      }

      h1 {
        margin: 0 0 6px;
        font-size: 22px;
      }

      .subtitle {
        margin: 0 0 20px;
        font-size: 13px;
        color: var(--muted);
      }

      .notice {
        display: none;
        align-items: flex-start;
        gap: 10px;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 16px;
        font-size: 14px;
        line-height: 1.45;
      }

      .notice.visible {
        display: flex;
      }

      .notice.success {
        background: var(--success-bg);
        border: 1px solid var(--success-border);
        color: var(--success-text);
      }

      .notice.error {
        background: var(--error-bg);
        border: 1px solid var(--error-border);
        color: var(--error-text);
      }

      .noticeIcon {
        width: 18px;
        height: 18px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .notice.success .noticeIcon {
        background: rgba(34, 197, 94, 0.25);
      }

      .notice.error .noticeIcon {
        background: rgba(237, 76, 103, 0.25);
      }

      form {
        display: grid;
        gap: var(--gap);
      }

      label {
        display: grid;
        gap: 8px;
        font-size: 13px;
        opacity: 0.92;
      }

      input,
      textarea {
        width: 100%;
        border: 1px solid var(--input-border);
        background: transparent;
        color: var(--text);
        border-radius: var(--field-radius);
        padding: 8px 10px;
        font: inherit;
      }

      textarea {
        min-height: 120px;
        resize: vertical;
      }

      input:focus,
      textarea:focus {
        border-color: var(--accent);
        outline: 2px solid rgba(43, 108, 255, 0.2);
        outline-offset: 0;
      }

      button[type="submit"] {
        margin-top: 6px;
        border: 1px solid var(--accent);
        background: linear-gradient(180deg, var(--accent-top) 0%, var(--accent-bottom) 100%);
        color: #fff;
        border-radius: var(--field-radius);
        padding: 10px 16px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      button[type="submit"]:hover {
        filter: brightness(1.06);
      }

      button[type="submit"]:disabled {
        opacity: 0.65;
        cursor: wait;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="brand">LeadFlow</div>
      <div class="card">
        <h1>Новая заявка</h1>
        <p class="subtitle">Заполните форму — заявка появится в приложении LeadFlow Bot.</p>

        <div id="notice" class="notice" role="status" aria-live="polite">
          <span class="noticeIcon" id="noticeIcon">i</span>
          <span id="noticeText"></span>
        </div>

        <form id="lead-form">
          <label>
            Имя
            <input name="name" required autocomplete="name" />
          </label>
          <label>
            Телефон
            <input name="phone" required autocomplete="tel" />
          </label>
          <label>
            Комментарий
            <textarea name="message" placeholder="Необязательно"></textarea>
          </label>
          <button type="submit" id="submitBtn">Отправить</button>
        </form>
      </div>
    </div>
    <script>
      const form = document.getElementById("lead-form");
      const notice = document.getElementById("notice");
      const noticeIcon = document.getElementById("noticeIcon");
      const noticeText = document.getElementById("noticeText");
      const submitBtn = document.getElementById("submitBtn");

      function showNotice(type, text) {
        notice.className = "notice visible " + type;
        noticeIcon.textContent = type === "success" ? "✓" : "!";
        noticeText.textContent = text;
        notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      function hideNotice() {
        notice.className = "notice";
        noticeText.textContent = "";
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        hideNotice();
        submitBtn.disabled = true;

        const payload = {
          name: form.name.value.trim(),
          phone: form.phone.value.trim(),
          message: form.message.value.trim()
        };

        try {
          const response = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok || !data.ok) {
            throw new Error(data.error || "Не удалось отправить заявку.");
          }

          form.reset();
          showNotice("success", "Заявка отправлена! Спасибо, мы скоро свяжемся с вами.");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Ошибка отправки.";
          showNotice("error", message);
        } finally {
          submitBtn.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}
