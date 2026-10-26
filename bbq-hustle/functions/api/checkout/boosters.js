import kit from '../../../kit-config.js';
import { checkoutHandler } from '../../../../shared/checkout/checkout.js';

export const onRequest = checkoutHandler(kit, 'boosters');
