import nodemailer from 'nodemailer'
import type { AppConfig } from '../config.js'

export interface Mailer {
  /** SMTP 未配置时为 false，此时开发环境把验证码打到控制台 */
  readonly configured: boolean
  sendVerificationCode(to: string, code: string): Promise<void>
}

export function createMailer(config: AppConfig): Mailer {
  if (!config.smtpEmail || !config.smtpAuthCode) {
    return {
      configured: false,
      async sendVerificationCode() {
        // 未配置 SMTP 时由调用方决定如何降级
      },
    }
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpEmail,
      pass: config.smtpAuthCode,
    },
  })

  return {
    configured: true,
    async sendVerificationCode(to: string, code: string) {
      await transporter.sendMail({
        from: `"NEXA 曜屏" <${config.smtpEmail}>`,
        to,
        subject: `NEXA 曜屏注册验证码 ${code}`,
        text: `你的注册验证码是 ${code}，10 分钟内有效。若非本人操作请忽略本邮件。`,
        html: `<div style="font-family:Segoe UI,PingFang SC,sans-serif;color:#0a111c">
  <p>你的 NEXA 曜屏注册验证码：</p>
  <p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p>
  <p style="color:#5a6a7e;font-size:12px">10 分钟内有效。若非本人操作请忽略本邮件。</p>
</div>`,
      })
    },
  }
}
