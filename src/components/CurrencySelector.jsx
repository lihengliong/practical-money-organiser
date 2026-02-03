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
    <div
      className={`flex items-center mb-5 bg-gradient-to-br from-white/80 to-slate-50/90
                  rounded-2xl py-4 px-5 shadow-lg backdrop-blur-sm border border-slate-200/60
                  transition-all duration-300 relative overflow-hidden
                  hover:-translate-y-0.5 hover:shadow-xl hover:border-blue-300/30
                  before:content-[''] before:absolute before:top-0 before:left-0 before:right-0
                  before:h-[3px] before:bg-gradient-to-r before:from-blue-500 before:via-purple-500 before:to-cyan-500
                  before:rounded-t-2xl
                  max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:py-3.5 max-sm:px-4
                  ${className || ''}`}
    >
      <label
        htmlFor={id}
        className="font-bold text-slate-800 mr-4 text-lg bg-gradient-to-br from-slate-800 to-slate-600
                   bg-clip-text text-transparent flex items-center gap-2
                   before:content-['💱'] before:text-xl before:bg-none before:text-inherit
                   max-sm:mr-0 max-sm:text-base"
      >
        <strong>{label}</strong>
      </label>
      <select
        id={id}
        value={baseCurrency}
        onChange={handleCurrencyChange}
        className="py-3 px-5 pr-10 rounded-xl border-2 border-slate-200
                   bg-gradient-to-br from-white to-slate-50 text-base font-semibold text-slate-800
                   transition-all duration-300 outline-none min-w-[200px] shadow-md cursor-pointer
                   backdrop-blur-sm appearance-none
                   bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%233b82f6%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3e%3cpolyline%20points=%276,9%2012,15%2018,9%27%3e%3c/polyline%3e%3c/svg%3e')]
                   bg-no-repeat bg-[right_12px_center] bg-[length:16px]
                   hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5
                   focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1),0_8px_25px_rgba(59,130,246,0.15)] focus:-translate-y-0.5
                   max-sm:min-w-[160px] max-sm:text-base max-sm:py-2.5 max-sm:px-4 max-sm:pr-9"
      >
        {currencyOptions.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-white text-slate-800 font-medium">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CurrencySelector;
