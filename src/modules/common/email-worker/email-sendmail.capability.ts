// src/modules/common/email-worker/email-sendmail.capability.ts
import type {
  CapabilityHealthCheck,
  CapabilityHealthResult,
} from '@app-types/common/capability.types';
import { Inject, Injectable } from '@nestjs/common';
import {
  CapabilityHealthCheckProvider,
  CapabilityProviderBindingProvider,
} from '@src/infrastructure/capability/capability.decorators';
import {
  EMAIL_DELIVERY_PROVIDER_KIND,
  EMAIL_SENDMAIL_PROVIDER_NAME,
  NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID,
} from '../email-capability/email-capability.constants';
import { EMAIL_DELIVERY_OPTIONS, type EmailDeliveryOptions } from './email-worker.options';

@Injectable()
@CapabilityProviderBindingProvider({
  capabilityId: NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID,
  providerKind: EMAIL_DELIVERY_PROVIDER_KIND,
  providerName: EMAIL_SENDMAIL_PROVIDER_NAME,
})
@CapabilityHealthCheckProvider({
  capabilityId: NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID,
  name: 'sendmail-config',
})
export class EmailSendmailCapabilityBinding implements CapabilityHealthCheck {
  constructor(
    @Inject(EMAIL_DELIVERY_OPTIONS)
    private readonly options: EmailDeliveryOptions,
  ) {}

  check(): Promise<CapabilityHealthResult> {
    const sendmailPath = this.options.sendmailPath.trim();
    const hasSendmailPath = sendmailPath.length > 0;
    return Promise.resolve({
      status: hasSendmailPath ? 'healthy' : 'unhealthy',
      checkedAt: new Date(),
      message: hasSendmailPath ? 'sendmail_provider_configured' : 'sendmail_path_missing',
      details: {
        deliveryMode: 'sendmail',
        sendmailPathConfigured: hasSendmailPath,
        runAsUserConfigured: Boolean(this.options.runAsUser?.trim()),
      },
    });
  }
}
