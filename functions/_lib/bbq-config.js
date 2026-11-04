// BBQ Hustle pricing and Stripe IDs. Change only with Wes's approval.
// Stripe test mode has its own objects, so test IDs differ from live IDs.
// Test IDs are null until the test-mode products, prices and coupon exist.
export const SCHEDULE_MONTHS = 12;

export const BBQ = {
  live: {
    prices: {
      boosters: 'price_1UIFSRHul7zqmXuKFEjzOHkG', // $15/month
      comboKit: 'price_1UUuTvHul7zqmXuKo4mkVmak', // $87 one-time
      comboBoosters: 'price_1UUtgWHul7zqmXuKxXwctylL', // $15/month
    },
    kitProduct: 'prod_VIr8uTdugWwOqn', // kit-only product, used to verify a buyer owns the kit
    // product id -> plan name, used by the webhook to decide what gets a schedule
    products: {
      prod_VIrAiHc6lQaAEX: 'boosters',
      prod_VVvXVUYJkHLsLm: 'combo',
    },
    blackFridayCoupon: 'F2kqBJLv', // $40 off once, kit + combo products only
    couponRedeemBy: 1796101140, // Nov 30, 2026 11:59 PM Eastern
  },
  test: {
    prices: {
      boosters: 'price_1USi3eHul7zqmXuKukZRUGqs',
      comboKit: 'price_1UUzN0Hul7zqmXuKBLZrSHj3',
      comboBoosters: 'price_1UUzN0Hul7zqmXuKZA7A2anG',
    },
    kitProduct: 'prod_VTdV47osuRkCNM',
    products: {
      prod_VTfC9UvHfD9KPB: 'boosters',
      prod_VW1PR4ctm5YHm9: 'combo',
    },
    blackFridayCoupon: '0oYPoIk5',
    couponRedeemBy: 1796101140,
  },
};
