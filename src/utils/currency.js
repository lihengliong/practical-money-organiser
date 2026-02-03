export async function fetchExchangeRates(base = 'SGD') {
  const API_KEY = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
  if (!API_KEY) {
    throw new Error('Exchange rate API key not configured. Please set VITE_EXCHANGE_RATE_API_KEY in .env file');
  }
  const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${base}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = await res.json();
  if (!data.conversion_rates) throw new Error('Invalid response from API');
  data.conversion_rates[base] = 1;
  return data.conversion_rates;
}