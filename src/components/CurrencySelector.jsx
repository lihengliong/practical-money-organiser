import { useCurrency } from '../contexts/CurrencyContext';

const currencyOptions = [
  { value: 'SGD', label: 'SGD (Singapore Dollar)' },
  { value: 'USD', label: 'USD (US Dollar)' },
  { value: 'EUR', label: 'EUR (Euro)' },
  { value: 'MYR', label: 'MYR (Malaysian Ringgit)' },
  { value: 'IDR', label: 'IDR (Indonesian Rupiah)' },
  { value: 'THB', label: 'THB (Thai Baht)' },
  { value: 'VND', label: 'VND (Vietnamese Dong)' },
  { value: 'PHP', label: 'PHP (Philippine Peso)' },
  { value: 'INR', label: 'INR (Indian Rupee)' },
  { value: 'CNY', label: 'CNY (Chinese Yuan)' },
  { value: 'JPY', label: 'JPY (Japanese Yen)' },
];

const CurrencySelector = ({ className, id = 'base-currency-select', label = 'Base Currency:' }) => {
  const { baseCurrency, updateBaseCurrency } = useCurrency();

  const handleCurrencyChange = (e) => {
    updateBaseCurrency(e.target.value);
  };

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {label && (
        <label htmlFor={id} className="text-white text-sm font-medium whitespace-nowrap">
          {label}
        </label>
      )}
      <select
        id={id}
        value={baseCurrency}
        onChange={handleCurrencyChange}
        className="py-1.5 px-3 pr-8 rounded-lg border border-white/30
                   bg-white/10 text-white text-sm font-medium
                   transition-all duration-200 outline-none cursor-pointer
                   appearance-none backdrop-blur-sm
                   bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%23ffffff%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3e%3cpolyline%20points=%276,9%2012,15%2018,9%27%3e%3c/polyline%3e%3c/svg%3e')]
                   bg-no-repeat bg-[right_8px_center] bg-[length:14px]
                   hover:bg-white/20 focus:bg-white/20 focus:border-white/50"
      >
        {currencyOptions.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-emerald-600 text-white font-medium">
            {opt.value}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CurrencySelector;
