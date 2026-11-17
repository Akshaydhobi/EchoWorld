let transactions = [];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recordTransactions(newTransactions) {
  if (!Array.isArray(newTransactions)) {
    throw new TypeError("Transaction ledger accepts an array.");
  }
  transactions.push(...newTransactions.map(clone));
}

function listTransactions({ agentId, tick, resource, limit = 50 } = {}) {
  const matching = transactions.filter((transaction) =>
    (!agentId || transaction.participants.includes(agentId)) &&
    (tick === undefined || transaction.tick === tick) &&
    (!resource || transaction.resource === resource || transaction.priceResource === resource)
  );
  return {
    count: matching.length,
    transactions: matching.slice(-limit).reverse().map(clone)
  };
}

function getTransactionCount() {
  return transactions.length;
}

function resetTransactions() {
  transactions = [];
}

module.exports = {
  getTransactionCount,
  listTransactions,
  recordTransactions,
  resetTransactions
};
