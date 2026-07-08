/**
 * Credenciais SMTP (Gmail App Password).
 * Obrigatórias ao enviar e-mail; não validadas no boot para não quebrar deploys sem e-mail.
 */
export function getSmtpCredentials(): { user: string; pass: string } {
  const user = process.env["SMTP_USER"]?.trim() ?? "";
  const pass = process.env["SMTP_PASS"]?.trim() ?? "";

  if (!user || !pass) {
    throw new Error("SMTP_USER e SMTP_PASS são obrigatórios para envio de e-mail");
  }

  return { user, pass };
}
