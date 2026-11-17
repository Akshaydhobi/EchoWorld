const TRADEABLE_RESOURCES = ["food", "energy", "materials", "knowledge", "healthcare"];
const BASE_PRICES = {
  food: 3,
  energy: 3,
  materials: 4,
  knowledge: 4,
  healthcare: 5
};
const BUY_THRESHOLDS = {
  food: 2,
  energy: 2,
  materials: 0,
  knowledge: 0,
  healthcare: 0
};
const SELL_THRESHOLDS = {
  food: 12,
  energy: 14,
  materials: 3,
  knowledge: 3,
  healthcare: 1
};
const BUY_PRIORITY = ["food", "energy", "healthcare", "materials", "knowledge"];

function getTradeIntent(observation) {
  const { self, environment } = observation;
  const resources = self.resources || {};
  const prices = environment.marketPrices || BASE_PRICES;
  const wantedResource = BUY_PRIORITY.find((resource) =>
    resources[resource] <= BUY_THRESHOLDS[resource] &&
    resources.money >= (prices[resource] || BASE_PRICES[resource]) &&
    environment.marketSummary?.[resource]?.potentialSellers > 0
  );
  if (wantedResource) {
    return {
      side: "buy",
      resource: wantedResource,
      price: prices[wantedResource] || BASE_PRICES[wantedResource],
      shortage: BUY_THRESHOLDS[wantedResource] + 1 - resources[wantedResource],
      counterpartyCount: environment.marketSummary[wantedResource].potentialSellers
    };
  }

  const availableToSell = TRADEABLE_RESOURCES
    .filter((resource) =>
      resources[resource] > SELL_THRESHOLDS[resource] &&
      environment.marketSummary?.[resource]?.potentialBuyers > 0
    )
    .sort((left, right) =>
      environment.marketSummary[right].potentialBuyers -
        environment.marketSummary[left].potentialBuyers ||
      (resources[right] - SELL_THRESHOLDS[right]) -
      (resources[left] - SELL_THRESHOLDS[left])
    );
  if (!availableToSell.length) return null;

  const resource = availableToSell[0];
  return {
    side: "sell",
    resource,
    price: prices[resource] || BASE_PRICES[resource],
    surplus: resources[resource] - SELL_THRESHOLDS[resource],
    counterpartyCount: environment.marketSummary[resource].potentialBuyers
  };
}

function calculateMarketPrices(demand, supply) {
  return Object.fromEntries(TRADEABLE_RESOURCES.map((resource) => {
    const imbalance = (demand[resource] || 0) - (supply[resource] || 0);
    const price = Math.max(1, Math.min(20, BASE_PRICES[resource] + imbalance));
    return [resource, price];
  }));
}

module.exports = {
  BASE_PRICES,
  BUY_THRESHOLDS,
  SELL_THRESHOLDS,
  TRADEABLE_RESOURCES,
  calculateMarketPrices,
  getTradeIntent
};
