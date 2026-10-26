import kit from '../../kit-config.js';
import { webhookHandler } from '../../../shared/checkout/webhook.js';

export const onRequestPost = webhookHandler(kit);
