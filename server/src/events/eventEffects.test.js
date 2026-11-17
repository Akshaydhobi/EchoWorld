const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyMarketPriceEvents,
  getMoneyBonus,
  getProductionQuantity
} = require("./eventEffects");

test("event effects adjust local production, business income, and market quotes", () => {
  const events = [
    {
      type: "weather-disruption",
      communityId: "greenfield",
      effects: { foodProductionMultiplier: 0.7 }
    },
    {
      type: "business-opportunity",
      communityId: "metrocore",
      effects: { moneyBonus: 6 }
    },
    {
      type: "market-change",
      resource: "food",
      effects: { priceMultiplier: 1.3 }
    }
  ];

  assert.equal(getProductionQuantity({ communityId: "greenfield" }, "food", 4, events), 2);
  assert.equal(getProductionQuantity({ communityId: "novadistrict" }, "food", 4, events), 4);
  assert.equal(getMoneyBonus({ role: "entrepreneur", communityId: "metrocore" }, events), 6);
  assert.equal(getMoneyBonus({ role: "farmer", communityId: "metrocore" }, events), 0);
  assert.equal(applyMarketPriceEvents({ food: 3 }, events).food, 4);
});
