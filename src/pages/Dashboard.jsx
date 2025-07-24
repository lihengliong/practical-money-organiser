import React, { useEffect, useState } from 'react';
import { db, auth } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { fetchExchangeRates } from '../utils/currency';
import CurrencySelector from '../components/CurrencySelector';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";

const pieColors = ["#3b82f6", "#10b981", "#f59e42", "#a78bfa", "#f43f5e", "#6366f1", "#fbbf24", "#ef4444"];

const Dashboard = () => {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [baseCurrency, setBaseCurrency] = useState('SGD');
  const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });
  const [allExpenses, setAllExpenses] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [lineData, setLineData] = useState([]);
  const [pieMode, setPieMode] = useState('month');
  const [netBalance, setNetBalance] = useState(0);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [avgYearly, setAvgYearly] = useState(0);
  const [mostFreqType, setMostFreqType] = useState('-');
  const now = new Date();

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
      setAllPayments(allPaymentsArr);
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
      const catAggAll = {};
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
        // All time
        catAggAll[cat] = (catAggAll[cat] || 0) + (e.splits.find(s => s.member === user.email)?.amountOwed ? convert(e.splits.find(s => s.member === user.email).amountOwed, e.currency) : 0);
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
      setPieData(pieMode === 'month'
        ? Object.entries(catAggMonth).map(([name, value]) => ({ name, value }))
        : Object.entries(catAggAll).map(([name, value]) => ({ name, value }))
      );
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
  }, [user, baseCurrency, exchangeRates, pieMode]);

  if (!user) return <div className="p-8">Please log in to view your ledger.</div>;
  if (loading) return <div>Loading ledger...</div>;

  return (
    <div className="analytics-container" style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
      <div style={{ fontSize: 44, fontWeight: 900, color: '#2563eb', marginBottom: 18, letterSpacing: '-1.5px' }}>
        Welcome, {user.displayName || user.email}!
      </div>
      <div className="analytics-summary-wrapper" style={{ marginBottom: 32 }}>
        <div className="analytics-summary-grid">
          <div className="analytics-card analytics-card-blue">
            <div className="analytics-card-title">Net Balance</div>
            <div className="analytics-card-value analytics-card-value-blue" style={{ color: netBalance > 0 ? '#10b981' : netBalance < 0 ? '#ef4444' : '#64748b' }}>{netBalance > 0 ? '+' : ''}{netBalance.toFixed(2)} {baseCurrency}</div>
          </div>
          <div className="analytics-card analytics-card-green">
            <div className="analytics-card-title">Total Expenses for the Month</div>
            <div className="analytics-card-value analytics-card-value-green">${monthlyTotal.toFixed(2)}</div>
          </div>
          <div className="analytics-card analytics-card-purple">
            <div className="analytics-card-title">Average Monthly Expenses</div>
            <div className="analytics-card-value analytics-card-value-purple">${avgYearly.toFixed(2)}</div>
          </div>
          <div className="analytics-card analytics-card-yellow">
            <div className="analytics-card-title">Most Spent Expense Type</div>
            <div className="analytics-card-value analytics-card-value-yellow">{mostFreqType}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 32, marginBottom: 32 }}>
        <div className="analytics-chart-card" style={{ flex: 1, minWidth: 600 }}>
          <div className="analytics-chart-title">Group Expenses (Last 6 Months)</div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={lineData} margin={{ top: 10, right: 30, left: 0, bottom: 36 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="analytics-chart-card" style={{ flex: 1, minWidth: 420 }}>
          <div className="analytics-chart-title">Expense Breakdown by Category</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, justifyContent: 'center' }}>
            <span style={{ fontSize: '0.89em', color: pieMode === 'month' ? '#2563eb' : '#64748b', fontWeight: pieMode === 'month' ? 600 : 400, letterSpacing: '0.01em' }}>This Month</span>
            <label className="pie-toggle-switch" style={{ position: 'relative', display: 'inline-block', width: 48, height: 26, margin: '0 4px', verticalAlign: 'middle' }}>
              <input
                type="checkbox"
                checked={pieMode === 'all'}
                onChange={() => setPieMode(pieMode === 'month' ? 'all' : 'month')}
                style={{ opacity: 0, width: 0, height: 0 }}
                aria-label="Toggle between This Month and All Time"
              />
              <span className="pie-toggle-slider" style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: pieMode === 'all' ? '#2563eb' : '#cbd5e1',
                borderRadius: 26,
                transition: 'background 0.2s',
              }}>
                <span style={{
                  position: 'absolute',
                  height: 22,
                  width: 22,
                  left: pieMode === 'all' ? 24 : 2,
                  bottom: 2,
                  background: '#fff',
                  borderRadius: '50%',
                  boxShadow: '0 1px 4px rgba(30,41,59,0.08)',
                  transition: 'left 0.2s',
                  border: '1.5px solid #cbd5e1',
                }} />
              </span>
            </label>
            <span style={{ fontSize: '0.89em', color: pieMode === 'all' ? '#2563eb' : '#64748b', fontWeight: pieMode === 'all' ? 600 : 400, letterSpacing: '0.01em' }}>All Time</span>
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