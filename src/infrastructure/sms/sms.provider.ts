export interface SmsSendRequest { phone: string; message: string; }
export interface SmsSendResult { providerMessageId?: string; }
export interface SmsProvider { send(request: SmsSendRequest): Promise<SmsSendResult>; }
