export async function fetchExchangeRates(base = 'SGD') {
  const API_KEY = 'xDzYl4TuS2XRCbRQa9OaHmYY3r44TeCW'; // Your real key
  // Always fetch with base=USD for free tier
  const url = `https://api.apilayer.com/exchangerates_data/latest?base=USD`;
  const res = await fetch(url, {
    headers: { apikey: API_KEY }
  });
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = await res.json();
  const ratesFromUSD = data.rates;
  ratesFromUSD['USD'] = 1; // Ensure USD is present

  // If base is USD or EUR, just return rates as usual
  if (base === 'USD' || base === 'EUR') {
    return ratesFromUSD;
  }

  // If base is not USD/EUR, convert via USD
  // rate(target) = rate(target)/rate(base)
  const baseRate = ratesFromUSD[base];
  if (!baseRate) {
    // fallback: just return USD rates
    return ratesFromUSD;
  }
  const convertedRates = {};
  for (const [currency, rate] of Object.entries(ratesFromUSD)) {
    convertedRates[currency] = rate / baseRate;
  }
  convertedRates[base] = 1;
  return convertedRates;
}