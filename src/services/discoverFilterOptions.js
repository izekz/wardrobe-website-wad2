export function surveyFilterOptions(preferences, mode, styles, occasions) {
  if (mode !== 'forYou' || !preferences) {
    return { styles, occasions, prices: [20, 40, 60, 100] }
  }
  const budget = Number(preferences.budget)
  const prices = [20, 40, 60, 100, budget]
    .filter(amount => Number.isFinite(amount) && amount > 0 && amount <= budget)
  return {
    styles: preferences.preferredStyles || [],
    occasions: preferences.activities || [],
    prices: [...new Set(prices)].sort((a, b) => a - b),
  }
}
