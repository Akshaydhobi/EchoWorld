const {
  BASE_PRICES,
  SELL_THRESHOLDS,
  TRADEABLE_RESOURCES,
  calculateMarketPrices
} = require("./marketRules");
const {
  applyMarketPriceEvents,
  getMoneyBonus,
  getProductionQuantity
} = require("../events/eventEffects");

const PRODUCTION_BY_ROLE = {
  farmer: { food: 4 },
  engineer: { energy: 3, materials: 1 },
  researcher: { knowledge: 2 },
  healthcareWorker: { healthcare: 2 },
  teacher: { knowledge: 1 }
};

const CONSUMPTION_PER_TICK = {
  food: 1,
  energy: 1
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addTransaction(transactions, tick, sequence, record) {
  transactions.push({
    id: `tx-${tick}-${String(sequence).padStart(4, "0")}`,
    tick,
    ...record
  });
  return sequence + 1;
}

function summarizeResources(outcomes) {
  const totals = Object.fromEntries(
    ["food", "money", "energy", "materials", "knowledge", "healthcare"].map((resource) => [resource, 0])
  );
  for (const { state } of outcomes) {
    for (const [resource, quantity] of Object.entries(state.resources)) {
      totals[resource] += quantity;
    }
  }
  return totals;
}

function updateTradeOutcome(state, tick, outcome) {
  const latestDecision = state.decisionHistory[state.decisionHistory.length - 1];
  if (latestDecision && latestDecision.tick === tick && latestDecision.action === "trade") {
    latestDecision.outcome = outcome;
  }
}

function coordinateEssentialResources(outcomes, tick, transactions, sequence) {
  let transfers = 0;
  for (const resource of Object.keys(CONSUMPTION_PER_TICK)) {
    const recipients = outcomes
      .filter((outcome) => outcome.state.resources[resource] < CONSUMPTION_PER_TICK[resource])
      .sort((left, right) => left.profile.id.localeCompare(right.profile.id));
    for (const recipient of recipients) {
      const donor = outcomes
        .filter((outcome) =>
          outcome.profile.id !== recipient.profile.id &&
          outcome.state.resources[resource] > CONSUMPTION_PER_TICK[resource]
        )
        .sort((left, right) =>
          right.state.resources[resource] - left.state.resources[resource] ||
          left.profile.id.localeCompare(right.profile.id)
        )[0];
      if (!donor) continue;

      donor.state.resources[resource] -= CONSUMPTION_PER_TICK[resource];
      recipient.state.resources[resource] += CONSUMPTION_PER_TICK[resource];
      sequence = addTransaction(transactions, tick, sequence, {
        type: "allocation",
        resource,
        quantity: CONSUMPTION_PER_TICK[resource],
        from: donor.profile.id,
        to: recipient.profile.id,
        participants: [donor.profile.id, recipient.profile.id],
        status: "completed"
      });
      transfers += 1;
    }
  }
  return { sequence, transfers };
}

function resolveEconomy(decisions, tick, activeEvents = [], { coordinationMode = "decentralized" } = {}) {
  if (!["centralized", "decentralized"].includes(coordinationMode)) {
    throw new TypeError("Coordination mode must be centralized or decentralized.");
  }
  const outcomes = decisions.map(({ profile, state, action }) => ({
    profile,
    state: {
      ...state,
      needs: { ...state.needs },
      resources: { ...state.resources },
      memory: {
        shortTerm: [...state.memory.shortTerm],
        longTerm: [...state.memory.longTerm]
      },
      learning: {
        ...state.learning,
        actionPerformance: { ...state.learning.actionPerformance }
      },
      relationships: [...state.relationships],
      socialHistory: [...state.socialHistory],
      decisionHistory: [...state.decisionHistory]
    },
    action
  }));
  const outcomesById = new Map(outcomes.map((outcome) => [outcome.profile.id, outcome]));
  const transactions = [];
  const produced = Object.fromEntries(TRADEABLE_RESOURCES.concat("money").map((resource) => [resource, 0]));
  const consumed = Object.fromEntries(TRADEABLE_RESOURCES.concat("money").map((resource) => [resource, 0]));
  let sequence = 1;

  for (const outcome of outcomes) {
    const production = PRODUCTION_BY_ROLE[outcome.profile.role] || {};
    for (const [resource, baseQuantity] of Object.entries(production)) {
      const quantity = getProductionQuantity(
        outcome.profile,
        resource,
        baseQuantity,
        activeEvents
      );
      if (quantity === 0) continue;
      outcome.state.resources[resource] += quantity;
      produced[resource] += quantity;
      sequence = addTransaction(transactions, tick, sequence, {
        type: "production",
        resource,
        quantity,
        from: null,
        to: outcome.profile.id,
        participants: [outcome.profile.id],
        status: "completed"
      });
    }
    const moneyBonus = getMoneyBonus(outcome.profile, activeEvents);
    if (moneyBonus > 0) {
      outcome.state.resources.money += moneyBonus;
      produced.money += moneyBonus;
      sequence = addTransaction(transactions, tick, sequence, {
        type: "production",
        resource: "money",
        quantity: moneyBonus,
        from: null,
        to: outcome.profile.id,
        participants: [outcome.profile.id],
        status: "completed"
      });
    }
  }

  let coordinatedTransfers = 0;
  if (coordinationMode === "centralized") {
    const coordination = coordinateEssentialResources(outcomes, tick, transactions, sequence);
    sequence = coordination.sequence;
    coordinatedTransfers = coordination.transfers;
  }

  for (const outcome of outcomes) {
    for (const [resource, quantity] of Object.entries(CONSUMPTION_PER_TICK)) {
      const available = outcome.state.resources[resource] >= quantity;
      if (available) {
        outcome.state.resources[resource] -= quantity;
        consumed[resource] += quantity;
        if (resource === "food") {
          outcome.state.needs.food = clamp(outcome.state.needs.food + 5, 0, 100);
        }
      } else if (resource === "food") {
        outcome.state.needs.food = clamp(outcome.state.needs.food - 12, 0, 100);
        outcome.state.wellbeing = clamp(outcome.state.wellbeing - 2, 0, 100);
      } else {
        outcome.state.energy = clamp(outcome.state.energy - 4, 0, 100);
        outcome.state.wellbeing = clamp(outcome.state.wellbeing - 1, 0, 100);
      }

      sequence = addTransaction(transactions, tick, sequence, {
        type: "consumption",
        resource,
        quantity,
        from: outcome.profile.id,
        to: null,
        participants: [outcome.profile.id],
        status: available ? "completed" : "blocked"
      });
    }
  }

  const buyers = [];
  const sellers = [];
  const demand = Object.fromEntries(TRADEABLE_RESOURCES.map((resource) => [resource, 0]));
  const supply = Object.fromEntries(TRADEABLE_RESOURCES.map((resource) => [resource, 0]));

  for (const outcome of outcomes) {
    if (outcome.action.type !== "trade" || !outcome.action.tradeIntent) continue;
    const order = {
      agentId: outcome.profile.id,
      communityId: outcome.profile.communityId,
      resource: outcome.action.tradeIntent.resource
    };
    if (outcome.action.tradeIntent.side === "buy") {
      buyers.push(order);
      demand[order.resource] += 1;
    } else {
      sellers.push(order);
      supply[order.resource] += 1;
    }
  }

  const baseMarketPrices = calculateMarketPrices(demand, supply);
  const marketPrices = applyMarketPriceEvents(baseMarketPrices, activeEvents);
  buyers.sort((left, right) => left.agentId.localeCompare(right.agentId));
  const usedAgents = new Set();
  let completedTrades = 0;

  for (const buyer of buyers) {
    if (usedAgents.has(buyer.agentId)) continue;
    const buyerOutcome = outcomesById.get(buyer.agentId);
    const price = marketPrices[buyer.resource];
    const seller = sellers
      .filter((candidate) =>
        candidate.resource === buyer.resource &&
        !usedAgents.has(candidate.agentId) &&
        outcomesById.get(candidate.agentId).state.resources[buyer.resource] >
          SELL_THRESHOLDS[buyer.resource]
      )
      .sort((left, right) =>
        Number(right.communityId === buyer.communityId) -
          Number(left.communityId === buyer.communityId) ||
        left.agentId.localeCompare(right.agentId)
      )[0];

    if (!seller || buyerOutcome.state.resources.money < price) {
      updateTradeOutcome(
        buyerOutcome.state,
        tick,
        seller ? "Market price exceeded available credits; no resources changed." : "No suitable seller was available; no resources changed."
      );
      continue;
    }

    const sellerOutcome = outcomesById.get(seller.agentId);
    sellerOutcome.state.resources[buyer.resource] -= 1;
    sellerOutcome.state.resources.money += price;
    buyerOutcome.state.resources[buyer.resource] += 1;
    buyerOutcome.state.resources.money -= price;
    updateTradeOutcome(buyerOutcome.state, tick, `Bought 1 ${buyer.resource} for ${price} credits.`);
    updateTradeOutcome(sellerOutcome.state, tick, `Sold 1 ${buyer.resource} for ${price} credits.`);
    usedAgents.add(buyer.agentId);
    usedAgents.add(seller.agentId);
    completedTrades += 1;

    sequence = addTransaction(transactions, tick, sequence, {
      type: "trade",
      resource: buyer.resource,
      quantity: 1,
      priceResource: "money",
      price,
      sellerId: seller.agentId,
      buyerId: buyer.agentId,
      participants: [seller.agentId, buyer.agentId],
      status: "completed"
    });
  }

  for (const seller of sellers) {
    if (!usedAgents.has(seller.agentId)) {
      updateTradeOutcome(
        outcomesById.get(seller.agentId).state,
        tick,
        "No suitable buyer was available; no resources changed."
      );
    }
  }

  const resourceTotals = summarizeResources(outcomes);
  const scarcity = Object.fromEntries(
    Object.keys(CONSUMPTION_PER_TICK).map((resource) => [
      resource,
      outcomes.filter((outcome) => outcome.state.resources[resource] === 0).length
    ])
  );
  const averageEnergy = outcomes.reduce((sum, outcome) => sum + outcome.state.energy, 0) / outcomes.length;
  const averageWellbeing = outcomes.reduce((sum, outcome) => sum + outcome.state.wellbeing, 0) / outcomes.length;

  return {
    states: outcomes.map(({ profile, state }) => ({ agentId: profile.id, state })),
    transactions,
    metrics: {
      production: produced,
      consumption: consumed,
      trades: completedTrades,
      coordinatedTransfers,
      blockedConsumption: transactions.filter((transaction) =>
        transaction.type === "consumption" && transaction.status === "blocked"
      ).length,
      scarcity,
      resourceTotals,
      baseMarketPrices,
      marketPrices,
      averageEnergy: Math.round(averageEnergy * 100) / 100,
      averageWellbeing: Math.round(averageWellbeing * 100) / 100
    }
  };
}

module.exports = { BASE_PRICES, PRODUCTION_BY_ROLE, resolveEconomy };
