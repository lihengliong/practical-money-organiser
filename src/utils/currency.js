// Cache configuration
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const ratesCache = new Map();

export async function fetchExchangeRates(base = 'SGD') {
  const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
  if (!API_KEY) {
    throw new Error('Exchange rate API key not configured. Please set VITE_EXCHANGE_RATE_API_KEY in .env file');
  }

  // Check cache first
  const cached = ratesCache.get(base);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.rates;
  }

  // Fetch fresh rates
  const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${base}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = await res.json();
  if (!data.conversion_rates) throw new Error('Invalid response from API');
  data.conversion_rates[base] = 1;

  // Update cache
  ratesCache.set(base, {
    rates: data.conversion_rates,
    timestamp: Date.now()
  });

  return data.conversion_rates;
}