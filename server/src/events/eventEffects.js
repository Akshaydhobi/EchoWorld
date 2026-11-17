function appliesToCommunity(event, communityId) {
  return !event.communityId || event.communityId === communityId;
}

function getProductionQuantity(profile, resource, quantity, events) {
  let multiplier = 1;
  for (const event of events) {
    if (!appliesToCommunity(event, profile.communityId)) continue;
    if (event.type === "weather-disruption" && resource === "food") {
      multiplier *= event.effects.foodProductionMultiplier;
    } else if (event.type === "energy-shortage" && resource === "energy") {
      multiplier *= event.effects.energyProductionMultiplier;
    } else if (event.type === "resource-scarcity" && resource === event.resource) {
      multiplier *= event.effects.resourceProductionMultiplier;
    } else if (event.type === "technology-discovery" && resource === "knowledge") {
      multiplier *= event.effects.knowledgeProductionMultiplier;
    } else if (event.type === "infrastructure-problem") {
      multiplier *= event.effects.productionMultiplier;
    }
  }
  return Math.max(0, Math.floor(quantity * multiplier));
}

function getMoneyBonus(profile, events) {
  if (!["entrepreneur", "trader"].includes(profile.role)) return 0;
  return events.reduce((bonus, event) =>
    event.type === "business-opportunity" &&
    appliesToCommunity(event, profile.communityId)
      ? bonus + event.effects.moneyBonus
      : bonus, 0
  );
}

function applyMarketPriceEvents(prices, events) {
  const result = { ...prices };
  for (const event of events) {
    if (event.type !== "market-change" || !event.resource) continue;
    const adjusted = result[event.resource] * event.effects.priceMultiplier;
    result[event.resource] = Math.max(1, Math.min(20, Math.round(adjusted)));
  }
  return result;
}

module.exports = {
  applyMarketPriceEvents,
  getMoneyBonus,
  getProductionQuantity
};
