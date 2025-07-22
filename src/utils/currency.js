export async function fetchExchangeRates(base = 'SGD') {
  const API_KEY = 'd5e93432a3c3a06d6114a1e0'; //(lihengliong@gmail.com)
  const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${base}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = await res.json();
  if (!data.conversion_rates) throw new Error('Invalid response from API');
  data.conversion_rates[base] = 1;
  return data.conversion_rates;
}