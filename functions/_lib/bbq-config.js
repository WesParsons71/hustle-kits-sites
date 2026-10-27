// BBQ Hustle pricing and Stripe IDs. Change only with Wes's approval.
// Stripe test mode has its own objects, so test IDs differ from live IDs.
// Test IDs are null until the test-mode products, prices and coupon exist.
export const SCHEDULE_ITERATIONS = 12;

export const BBQ = {
  live: {
    prices: {
      boosters: 'price_1UIFSRHul7zqmXuKFEjzOHkG', // $15/month
      comboKit: 'price_1UUuTvHul7zqmXuKo4mkVmak', // $87 one-time
      comboBoosters: 'price_1UUtgWHul7zqmXuKxXwctylL', // $15/month
    },
    // product id -> plan name, used by the webhook to decide what gets a schedule
    products: {
      prod_VIrAiHc6lQaAEX: 'boosters',
      prod_VVvXVUYJkHLsLm: 'combo',
    },
    blackFridayCoupon: 'F2kqBJLv', // $40 off once, kit + combo products only
    couponRedeemBy: 1796101140, // Nov 30, 2026 11:59 PM Eastern
  },
  test: {
    prices: { boosters: null, comboKit: null, comboBoosters: null },
    products: {},
    blackFridayCoupon: null,
    couponRedeemBy: 1796101140,
  },
};
