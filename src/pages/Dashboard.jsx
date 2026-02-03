import React, { useEffect, useState } from 'react';
import { db, auth } from '../config/firebase.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { fetchExchangeRates } from '../utils/currency.js';
import CurrencySelector from '../components/CurrencySelector.jsx';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";

const pieColors = ["#3b82f6", "#10b981", "#f59e42", "#a78bfa", "#f43f5e", "#6366f1", "#fbbf24", "#ef4444"];

const Dashboard = () => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  // Use global currency context instead of local state
  const { baseCurrency } = useCurrency();
  const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });
  const [allExpenses, setAllExpenses] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [pieMode, setPieMode] = useState('month');
  const [netBalance, setNetBalance] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [avgYearly, setAvgYearly] = useState(0);
  const [mostFreqType, setMostFreqType] = useState('-');

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const rates = await fetchExchangeRates(baseCurrency);
        setExchangeRates(rates);
      } catch {
        setExchangeRates({ [baseCurrency]: 1 });
      }
    };
    fetchRates();
  }, [baseCurrency]);

  useEffect(() => {
    const fetchLedger = async () => {
      if (!user) return;
      setLoading(true);
      // Fetch all groups the user is in
      const groupsSnapshot = await getDocs(query(collection(db, 'groups'), where('members', 'array-contains', user.email)));
      const groups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Fetch all expenses and payments for these groups
      let allExpensesArr = [];
      let allPaymentsArr = [];
      for (const group of groups) {
        const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', group.id)));
        allExpensesArr = allExpensesArr.concat(expensesSnapshot.docs.map(doc => ({ ...doc.data(), group })));
        const paymentsSnapshot = await getDocs(query(collection(db, 'payments'), where('groupId', '==', group.id)));
        allPaymentsArr = allPaymentsArr.concat(paymentsSnapshot.docs.map(doc => ({ ...doc.data(), group })));
      }
      setAllExpenses(allExpensesArr);
      // --- Summary Calculations ---
      const base = baseCurrency.toUpperCase();
      const rateBase = exchangeRates[base];
      const convert = (amount, currency) => {
        const curr = (currency || base).toUpperCase();
        const rateExpense = exchangeRates[curr];
        if (
          curr !== base &&
          typeof rateBase === 'number' &&
          typeof rateExpense === 'number' &&
          rateExpense !== 0
        ) {
          return amount * (rateBase / rateExpense);
        }
        return amount;
      };
      // Net Balance (owes/owed across all groups, including payments)
      let net = 0;
      allExpensesArr.forEach(e => {
        if (!e.splits) return;
        if (e.paidBy === user.email) {
          e.splits.forEach(split => {
            if (split.member !== user.email) net += convert(split.amountOwed, e.currency);
          });
        } else if (e.splits.some(s => s.member === user.email)) {
          const userSplit = e.splits.find(s => s.member === user.email);
          net -= convert(userSplit.amountOwed, e.currency);
        }
      });
      // Subtract payments made to the user, add payments made by the user
      allPaymentsArr.forEach(payment => {
        // Payments are assumed to be in base currency
        if (payment.fromUser === user.email) {
          net += payment.amount;
        } else if (payment.toUser === user.email) {
          net -= payment.amount;
        }
      });
      setNetBalance(net);
      // Total Expenses for the Month (all expenses user participated in, this month)
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      let monthTotal = 0;
      allExpensesArr.forEach(e => {
        if (!e.splits || !e.splits.some(s => s.member === user.email)) return;
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
        if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
          const split = e.splits.find(s => s.member === user.email);
          monthTotal += split ? convert(split.amountOwed, e.currency) : 0;
        }
      });
      setMonthlyTotal(monthTotal);
      // Average Monthly Expenses (user's share, across all groups, divided by number of months with at least one expense)
      // Find all months (YYYY-MM) where user has an expense
      const monthMap = {};
      let totalUserExpenses = 0;
      allExpensesArr.forEach(e => {
        if (!e.splits || !e.splits.some(s => s.member === user.email)) return;
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const split = e.splits.find(s => s.member === user.email);
        if (split) {
          totalUserExpenses += convert(split.amountOwed, e.currency);
          monthMap[key] = true;
        }
      });
      const numMonths = Object.keys(monthMap).length;
      setAvgYearly(numMonths > 0 ? totalUserExpenses / numMonths : 0);
      // Most Spent Expense Type (category, for this month only, by amount)
      const catAggMonth = {};
      allExpensesArr.forEach(e => {
        if (!e.splits || !e.splits.some(s => s.member === user.email)) return;
        let cat = e.category || 'Other';
        if (typeof cat === 'string') {
          cat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        }
        // This month
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
        if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
          catAggMonth[cat] = (catAggMonth[cat] || 0) + (e.splits.find(s => s.member === user.email)?.amountOwed ? convert(e.splits.find(s => s.member === user.email).amountOwed, e.currency) : 0);
        }
      });
      // Find the category with the highest amount for this month
      let mostSpent = '-';
      let maxSpent = 0;
      Object.entries(catAggMonth).forEach(([cat, amount]) => {
        if (amount > maxSpent) {
          mostSpent = cat;
          maxSpent = amount;
        }
      });
      setMostFreqType(mostSpent);
      // Line chart data (last 6 months)
      const months = [];
      const lineMonthMap = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        months.push(label);
        lineMonthMap[`${d.getFullYear()}-${d.getMonth()}`] = label;
      }
      const lineAgg = {};
      allExpensesArr.forEach(e => {
        if (!e.splits || !e.splits.some(s => s.member === user.email)) return;
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const split = e.splits.find(s => s.member === user.email);
        if (lineMonthMap[key]) {
          lineAgg[lineMonthMap[key]] = (lineAgg[lineMonthMap[key]] || 0) + (split ? convert(split.amountOwed, e.currency) : 0);
        }
      });
      setLineData(months.map(m => ({ month: m, total: lineAgg[m] || 0 })));
      setLoading(false);
    };
    fetchLedger();
  }, [user, baseCurrency, exchangeRates]);

  // Pie chart data calculation - only update when pieMode, allExpenses, user, exchangeRates, or baseCurrency changes
  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const base = baseCurrency.toUpperCase();
    const rateBase = exchangeRates[base];
    const convert = (amount, currency) => {
      const curr = (currency || base).toUpperCase();
      const rateExpense = exchangeRates[curr];
      if (
        curr !== base &&
        typeof rateBase === 'number' &&
        typeof rateExpense === 'number' &&
        rateExpense !== 0
      ) {
        return amount * (rateBase / rateExpense);
      }
      return amount;
    };
    const catAggMonth = {};
    const catAggAll = {};
    allExpenses.forEach(e => {
      if (!e.splits || !e.splits.some(s => s.member === user.email)) return;
      let cat = e.category || 'Other';
      if (typeof cat === 'string') {
        cat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
      }
      // This month
      const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
        catAggMonth[cat] = (catAggMonth[cat] || 0) + (e.splits.find(s => s.member === user.email)?.amountOwed ? convert(e.splits.find(s => s.member === user.email).amountOwed, e.currency) : 0);
      }
      // All time
      catAggAll[cat] = (catAggAll[cat] || 0) + (e.splits.find(s => s.member === user.email)?.amountOwed ? convert(e.splits.find(s => s.member === user.email).amountOwed, e.currency) : 0);
    });
    setPieData(pieMode === 'month'
      ? Object.entries(catAggMonth).map(([name, value]) => ({ name, value }))
      : Object.entries(catAggAll).map(([name, value]) => ({ name, value }))
    );
  }, [pieMode, allExpenses, user, exchangeRates, baseCurrency]);

  if (!user) return <div className="p-8 text-gray-600">Please log in to view your ledger.</div>;
  if (loading) return <div className="p-8 text-gray-600">Loading ledger...</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-2 box-border">
      <div className="text-[2.5rem] font-black text-emerald-600 mb-5 -tracking-[1.5px] text-left
                      mx-auto max-w-[1100px] w-full pl-2
                      max-sm:text-[30px] sm:pl-0">
        Welcome, {user.displayName ? user.displayName : user.email.split('@')[0]}!
      </div>
      
      <div className="flex flex-col items-center justify-center mb-10">
        <div className="w-full max-w-[1100px] grid grid-cols-1 gap-6
                        sm:grid-cols-2 lg:grid-cols-4">
          {/* Net Balance Card */}
          <div className="card-stat bg-gradient-to-br from-blue-50 via-blue-100/80 to-sky-50">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Net Balance
            </div>
            <div className={`text-[2rem] font-extrabold mb-1 leading-tight shadow-sm
                            max-sm:text-[1.3em]
                            ${netBalance > 0.009 ? 'text-emerald-500' : netBalance < -0.009 ? 'text-red-500' : 'text-slate-500'}`}>
              {baseCurrency === 'DEFAULT' ? (
                <span className="text-sm text-gray-500">Select currency</span>
              ) : (
                <>{netBalance > 0.009 ? '+' : ''}{Math.abs(netBalance) < 0.01 ? '0.00' : netBalance.toFixed(2)} {baseCurrency}</>
              )}
            </div>
          </div>

          {/* Monthly Total Card */}
          <div className="card-stat bg-gradient-to-br from-emerald-50 via-green-100/80 to-emerald-50">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Total Expenses for the Month
            </div>
            <div className="text-[2rem] font-extrabold mb-1 leading-tight text-emerald-600 shadow-sm
                            max-sm:text-[1.3em]">
              {baseCurrency === 'DEFAULT' ? (
                <span className="text-sm text-gray-500">Select currency</span>
              ) : (
                <>{monthlyTotal.toFixed(2)} {baseCurrency}</>
              )}
            </div>
          </div>

          {/* Average Monthly Card */}
          <div className="card-stat bg-gradient-to-br from-violet-50 via-purple-100/80 to-violet-50">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Average Monthly Expenses
            </div>
            <div className="text-[2rem] font-extrabold mb-1 leading-tight text-violet-600 shadow-sm
                            max-sm:text-[1.3em]">
              {baseCurrency === 'DEFAULT' ? (
                <span className="text-sm text-gray-500">Select currency</span>
              ) : (
                <>{avgYearly.toFixed(2)} {baseCurrency}</>
              )}
            </div>
          </div>

          {/* Most Spent Type Card */}
          <div className="card-stat bg-gradient-to-br from-yellow-50 via-amber-100/80 to-yellow-50">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Most Spent Expense Type
            </div>
            <div className="text-[2rem] font-extrabold mb-1 leading-tight text-amber-500 shadow-sm
                            max-sm:text-[1.3em]">
              {mostFreqType}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="w-full max-w-[1100px] mx-auto mb-10 grid grid-cols-1 gap-8
                      lg:grid-cols-2 max-sm:gap-4">
        {/* Line Chart */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 py-10 px-8
                        flex flex-col items-center min-h-[420px]
                        transition-shadow duration-200 hover:shadow-xl
                        max-sm:py-5 max-sm:px-2 max-sm:min-h-[260px]">
          <div className="font-bold text-xl text-slate-700 mb-6 text-center tracking-tight
                          max-sm:text-base">
            My Expenses (Last 6 Months)
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={lineData} margin={{ top: 10, right: 30, left: 0, bottom: 36 }}>
              <defs>
                <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.7}/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontWeight: 600, fontSize: 14 }} />
              <YAxis tick={{ fill: '#64748b', fontWeight: 600, fontSize: 14 }} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, boxShadow: '0 4px 24px #3b82f622', border: 'none', background: '#fff' }} labelStyle={{ color: '#2563eb', fontWeight: 700 }} />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={4} dot={{ r: 7, fill: '#fff', stroke: '#3b82f6', strokeWidth: 3, filter: 'drop-shadow(0 2px 8px #3b82f633)' }} activeDot={{ r: 10, fill: '#3b82f6', stroke: '#fff', strokeWidth: 3 }} fill="url(#colorLine)" />
              {/* Area for subtle gradient fill under the line */}
              <area type="monotone" dataKey="total" stroke={false} fill="url(#colorLine)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 py-10 px-8
                        flex flex-col items-center min-h-[420px]
                        transition-shadow duration-200 hover:shadow-xl
                        max-sm:py-5 max-sm:px-2 max-sm:min-h-[260px]">
          <div className="font-bold text-xl text-slate-700 mb-6 text-center tracking-tight
                          max-sm:text-base">
            Expense Breakdown by Category
          </div>
          
          {/* Toggle Switch */}
          <div className="flex items-center gap-2.5 mb-2.5 justify-center">
            <span className={`text-sm tracking-tight
                             ${pieMode === 'month' ? 'text-emerald-600 font-semibold' : 'text-slate-500 font-normal'}`}>
              This Month
            </span>
            <label className="relative inline-block w-12 h-[26px] mx-1 align-middle">
              <input
                type="checkbox"
                checked={pieMode === 'all'}
                onChange={() => setPieMode(pieMode === 'month' ? 'all' : 'month')}
                className="opacity-0 w-0 h-0 peer"
                aria-label="Toggle between This Month and All Time"
              />
              <span className="absolute inset-0 bg-slate-300 rounded-full cursor-pointer
                               peer-checked:bg-emerald-500 transition-colors">
                <span className={`absolute h-[22px] w-[22px] bottom-0.5 bg-white rounded-full
                                 shadow-sm transition-all border-[1.5px]
                                 ${pieMode === 'all' ? 'left-6 border-emerald-500' : 'left-0.5 border-slate-300'}`} />
              </span>
            </label>
            <span className={`text-sm tracking-tight
                             ${pieMode === 'all' ? 'text-emerald-600 font-semibold' : 'text-slate-500 font-normal'}`}>
              All Time
            </span>
          </div>

          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 