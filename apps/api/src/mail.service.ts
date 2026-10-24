import nodemailer, { type Transporter } from "nodemailer";
import type { SmtpConfig } from "./config.js";

let smtp: SmtpConfig = {
  host: null,
  port: 587,
  secure: false,
  user: null,
  password: null,
  from: "EDUCAR PARA TRANSFORMAR <no-reply@educar.local>",
};
let transporter: Transporter | null = null;

export function configureMail(config: SmtpConfig): void {
  smtp = config;
  transporter = null;
}

export function resetMailTransport(): void {
  transporter = null;
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = smtp.host
      ? nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: smtp.user ? { user: smtp.user, pass: smtp.password ?? "" } : undefined,
        })
      : nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export async function sendMail(input: MailInput): Promise<{ messageId: string; transport: "smtp" | "json" }> {
  const info = await getTransporter().sendMail({
    from: smtp.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
  return { messageId: info.messageId, transport: smtp.host ? "smtp" : "json" };
}
