export async function fetchExchangeRates(base = 'SGD') {
  const API_KEY = '1734f66aed7839eee5e0d51e'; //(levileox@gmail.com - create new account & key when api usage runs out)
  const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${base}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = await res.json();
  if (!data.conversion_rates) throw new Error('Invalid response from API');
  data.conversion_rates[base] = 1;
  return data.conversion_rates;
}