// BBQ Hustle checkout config. Price IDs below are LIVE mode. In test mode,
// set the STRIPE_PRICE_* env vars to the test-mode equivalents.
// Change pricing only with Wes's approval.
export default {
  name: 'bbq-hustle',
  siteUrl: 'https://thebbqhustle.com',
  boostersMonths: 12,
  // Coupon F2kqBJLv redeem-by: Nov 30 2026, 11:59 PM Eastern.
  blackFridayRedeemBy: 1796101140,
  plans: {
    boosters: {
      product: 'prod_VIrAiHc6lQaAEX',
      prices: [{ env: 'STRIPE_PRICE_BOOSTERS', id: 'price_1UIFSRHul7zqmXuKFEjzOHkG' }],
      successUrlEnv: 'BOOSTERS_SUCCESS_URL', // welcome page URL: waiting on Wes
      cancelPath: '/boosters',
      discounts: false,
    },
    combo: {
      product: 'prod_VVvXVUYJkHLsLm',
      prices: [
        { env: 'STRIPE_PRICE_COMBO_KIT', id: 'price_1UUuTvHul7zqmXuKo4mkVmak' },
        { env: 'STRIPE_PRICE_COMBO_BOOSTERS', id: 'price_1UUtgWHul7zqmXuKxXwctylL' },
      ],
      successUrlEnv: 'COMBO_SUCCESS_URL',
      successUrl: '/thank-you',
      cancelPath: '/',
      discounts: true,
    },
  },
};
