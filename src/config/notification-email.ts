import nodemailer from "nodemailer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  message: string,
) {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;

  if (!emailUser || !emailPassword) {
    throw new Error("Email SMTP credentials are not configured.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });

  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

  await transporter.sendMail({
    from: `"YSSE " <${emailUser}>`,
    to,
    subject,
    text: message,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.7">
        <h2>YSSE Notification</h2>
        <p>${safeMessage}</p>
        <hr />
        <small>This is an automated notification from YSSE .</small>
      </div>
    `,
  });
}