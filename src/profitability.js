// Profitability engine — PRD Phase 1 section 6 (P0).
//
// Formula (PRD ki di hui, koi ijafi cheez nahi):
//   grossSpread      = order_rate − rent
//   netMonthlyMargin = order_rate − rent − agentFee − otherCosts
//
// Costs ka usool (Asad ka saaf hukum): costs INVENT nahi karte. Order me
// agent_fee/other_costs diye hon to wahi; na diye hon to 0 use hota hai
// LEKIN `costsSpecified:false` ke sath — UI is se saaf batata hai ke margin
// "before costs" hai, koi andaza chupke se nahi ghusta.
//
// Pure function — na NocoDB, na config. Bot aur dashboard dono import kar
// sakte hain (message-template.js wala pattern).

/**
 * @param order   { order_rate, agent_fee?, other_costs? }
 * @param listing { price }
 * @returns null agar order_rate ya rent hi nahi (kuch compute nahi ho sakta),
 *          warna: { gross_spread, agent_fee, other_costs, costs_specified,
 *                   net_monthly_margin, annual_margin, margin_percentage,
 *                   profitability_status }
 */
export function computeProfitability(order, listing) {
  const rate = num(order?.order_rate);
  const rent = num(listing?.price);
  if (rate == null || rent == null) return null;

  const agentFee = num(order?.agent_fee);
  const otherCosts = num(order?.other_costs);
  // Costs "specified" tab hain jab order me kam az kam ek explicitly diya gaya
  // ho (0 dena bhi "diya" hai — matlab business rule ne bataya cost nahi lagti).
  const costsSpecified = agentFee != null || otherCosts != null;

  const gross = rate - rent;
  const net = rate - rent - (agentFee ?? 0) - (otherCosts ?? 0);
  const pct = rate > 0 ? Math.round((net / rate) * 1000) / 10 : null;

  return {
    gross_spread: gross,
    agent_fee: agentFee ?? 0,
    other_costs: otherCosts ?? 0,
    costs_specified: costsSpecified,
    net_monthly_margin: net,
    annual_margin: net * 12,
    margin_percentage: pct,
    profitability_status: statusFor(net),
  };
}

// Thresholds — PRD ke example se calibrate (net £270 = "Good Deal" dikhaya
// gaya hai). Yehi Phase 4 me per-client configurable banega.
function statusFor(net) {
  if (net >= 250) return 'good';
  if (net >= 100) return 'ok';
  if (net >= 0) return 'low';
  return 'loss';
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? n : null;
}
