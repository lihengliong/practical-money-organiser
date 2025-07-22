import React from 'react';
import './stylesheets/currency-selector.css';

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

const CurrencySelector = ({ value, onChange, style, className, id = 'base-currency-select', label = 'Base Currency:' }) => (
  <div className={`currency-selector-container ${className || ''}`} style={style}>
    <label htmlFor={id} className="currency-selector-label"><strong>{label}</strong></label>
    <select
      id={id}
      value={value}
      onChange={onChange}
      className="currency-selector-dropdown"
    >
      {currencyOptions.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export default CurrencySelector; 