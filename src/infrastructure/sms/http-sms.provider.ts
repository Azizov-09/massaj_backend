import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';
import { SmsProvider, SmsSendRequest, SmsSendResult } from './sms.provider';
interface SmsProviderResponse { id?: string; messageId?: string; }
@Injectable()
export class HttpSmsProvider implements SmsProvider {
  constructor(private readonly config: ConfigService<AppConfiguration>) {}
  async send(request: SmsSendRequest): Promise<SmsSendResult> { const response = await fetch(this.config.getOrThrow('sms.apiUrl', { infer: true }), { method: 'POST', headers: { authorization: `Bearer ${this.config.getOrThrow('sms.apiKey', { infer: true })}`, 'content-type': 'application/json' }, body: JSON.stringify({ to: request.phone, from: this.config.getOrThrow('sms.sender', { infer: true }), text: request.message }) }); if (!response.ok) throw new Error(`SMS provider rejected request with HTTP ${response.status}`); const body: unknown = await response.json().catch(() => ({})); const data = typeof body === 'object' && body !== null ? body as SmsProviderResponse : {}; return { providerMessageId: data.messageId ?? data.id }; }
}
