/**
 * Postmark email sender.
 * All outbound email goes through this module.
 */
import { ServerClient } from "postmark";
import { config } from "@/lib/config";

let _client: ServerClient | null = null;
function getClient(): ServerClient {
  if (!_client) _client = new ServerClient(config.postmark.serverToken);
  return _client;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  from?: string;      // defaults to config.postmark.fromAddress
  replyTo?: string;
  messageStream?: string;
}

export interface SendEmailResult {
  messageId: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    subject,
    htmlBody,
    textBody,
    from = config.postmark.fromAddress,
    replyTo,
    messageStream = "outbound",
  } = options;

  const result = await getClient().sendEmail({
    From: from,
    To: to,
    Subject: subject,
    HtmlBody: htmlBody,
    TextBody: textBody,
    ReplyTo: replyTo,
    MessageStream: messageStream,
  });

  return { messageId: result.MessageID };
}
