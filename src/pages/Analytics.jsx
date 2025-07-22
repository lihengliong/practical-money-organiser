import React, { useEffect, useState, createContext, useContext } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar
} from "recharts";
import { db, auth } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import './stylesheets/analytics.css';
import CurrencySelector from '../components/CurrencySelector';
import { fetchExchangeRates } from '../utils/currency';

const pieColors = ["#3b82f6", "#10b981", "#f59e42", "#a78bfa", "#f43f5e", "#6366f1", "#fbbf24", "#ef4444"];

function ExpensesLineChart({ data, baseCurrency }) {
  // Custom tick formatter for x-axis: show month above, year below
  const renderCustomTick = (props) => {
    const { x, y, payload } = props;
    const [month, year] = payload.value.split(' ');
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={8} textAnchor="middle" fill="#64748b" fontSize="14">
          {month}
        </text>
        <text x={0} y={0} dy={24} textAnchor="middle" fill="#94a3b8" fontSize="12">
          {year.slice(-2)}
        </text>
      </g>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 36 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={renderCustomTick} interval={0} />
        <YAxis label={{ value: baseCurrency, angle: -90, position: 'insideLeft', offset: 10, fontSize: 14, fill: '#64748b' }} />
        <Tooltip />
        <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CategoryPieChart({ data }) {
  // Custom tooltip to show category and value
  const renderCustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const { name, value } = payload[0].payload;
      return (
        <div style={{ background: '#fff', border: '1px solid #ccc', padding: 8, borderRadius: 4 }}>
          <strong>{name}</strong><br />
          Amount: ${value.toFixed(2)}
        </div>
      );
    }
    return null;
  };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          // No label prop, so no text over the chart
        >
          {data.map((entry, idx) => (
            <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
          ))}
        </Pie>
        <Legend />
        <Tooltip content={renderCustomTooltip} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ContributionsBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="total" fill="#10b981" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Context for Pie Chart Mode
const PieModeContext = createContext();

export function usePieMode() {
  return useContext(PieModeContext);
}

export default function Analytics() {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [lineData, setLineData] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [barData, setBarData] = useState([]);
  const [baseCurrency, setBaseCurrency] = useState('SGD');
  const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });
  // Get current month name for display
  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const [pieMode, setPieMode] = useState('month'); // 'month' or 'all'

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
    if (!user) return;
    setLoading(true);
    (async () => {
      // 1. Fetch all groups the user is in
      const groupsSnapshot = await getDocs(query(collection(db, 'groups'), where('members', 'array-contains', user.email)));
      const groups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (!groups.length) {
        setLineData([]);
        setAllExpenses([]);
        setBarData([]);
        setLoading(false);
        return;
      }
      // 2. Fetch all expenses for those groups
      let allExpensesArr = [];
      for (const group of groups) {
        const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', group.id)));
        allExpensesArr = allExpensesArr.concat(expensesSnapshot.docs.map(doc => ({ ...doc.data(), group })));
      }
      // --- Summary Cards ---
      // Convert all amounts to base currency
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
      // Total group expenses this month
      const totalThisMonth = allExpensesArr
        .filter(e => {
          const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, e) => sum + (typeof e.amount === 'number' ? convert(e.amount, e.currency) : 0), 0);
      // My personal contributions
      const myContributions = allExpensesArr
        .filter(e => e.paidBy === user.email)
        .reduce((sum, e) => sum + (typeof e.amount === 'number' ? convert(e.amount, e.currency) : 0), 0);
      // Net balance (owes/owed)
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
      // Most frequent payer
      const payerCounts = {};
      allExpensesArr.forEach(e => {
        if (!e.paidBy) return;
        payerCounts[e.paidBy] = (payerCounts[e.paidBy] || 0) + 1;
      });
      let mostFrequentPayerCalc = '-';
      let maxCount = 0;
      Object.entries(payerCounts).forEach(([payer, count]) => {
        if (count > maxCount) {
          mostFrequentPayerCalc = payer;
          maxCount = count;
        }
      });
      // --- Line Chart: Expenses per month (last 6 months) ---
      const months = [];
      const monthMap = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString('default', { month: 'short', year: 'numeric' }); // e.g., 'Jun 2024'
        months.push(label);
        monthMap[`${d.getFullYear()}-${d.getMonth()}`] = label;
      }
      const lineAgg = {};
      allExpensesArr.forEach(e => {
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (monthMap[key]) {
          lineAgg[monthMap[key]] = (lineAgg[monthMap[key]] || 0) + (typeof e.amount === 'number' ? convert(e.amount, e.currency) : 0);
        }
      });
      setLineData(months.map(m => ({ month: m, total: lineAgg[m] || 0 })));
      // --- Pie Chart: Expense breakdown by category (toggle month/all) ---
      // Pie data is handled in the pie chart section using context, pass baseCurrency and exchangeRates
      // --- Bar Chart: Member contributions ---
      const memberAgg = {};
      allExpensesArr.forEach(e => {
        if (!e.paidBy) return;
        memberAgg[e.paidBy] = (memberAgg[e.paidBy] || 0) + (typeof e.amount === 'number' ? convert(e.amount, e.currency) : 0);
      });
      setBarData(Object.entries(memberAgg).map(([name, total]) => ({ name, total })));
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      // My total expenses this month (my share of all splits)
      const myTotalThisMonth = allExpensesArr
        .filter(e => {
          const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear && e.splits && e.splits.some(s => s.member === user.email);
        })
        .reduce((sum, e) => {
          const split = e.splits.find(s => s.member === user.email);
          return sum + (split ? convert(split.amountOwed, e.currency) : 0);
        }, 0);
      setSummary({
        totalThisMonth, // keep for reference if needed
        myContributions,
        net,
        myTotalThisMonth
      });
      setMostFrequentPayer(mostFrequentPayerCalc);
      setAllExpenses(allExpensesArr);
      setLoading(false);
    })();
  }, [user, baseCurrency, exchangeRates]);

  // State for summary values
  const [summary, setSummary] = useState({ totalThisMonth: 0, myContributions: 0, net: 0 });
  const [mostFrequentPayer, setMostFrequentPayer] = useState('-');

  if (!user) return <div className="p-8">Please log in to view analytics.</div>;
  if (loading) return <div className="p-8">Loading analytics...</div>;

  return (
    <PieModeContext.Provider value={{ pieMode, setPieMode }}>
      <div className="analytics-container">
        <CurrencySelector value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} style={{ marginBottom: 24 }} />
        {/* Centralized Summary Cards Section */}
        <div className="analytics-summary-wrapper">
          <div className="analytics-summary-grid">
            {/* My Total Expenses This Month Card */}
            <div className="analytics-card analytics-card-blue">
              <div className="analytics-card-title">Total Expenses Incurred by Me (This Month: {monthName})</div>
              <div className="analytics-card-value analytics-card-value-blue">${summary.myTotalThisMonth ? summary.myTotalThisMonth.toFixed(2) : '0.00'}</div>
            </div>
            {/* My Contributions Card */}
            <div className="analytics-card analytics-card-green">
              <div className="analytics-card-title">My Contributions</div>
              <div className="analytics-card-value analytics-card-value-green">${summary.myContributions.toFixed(2)}</div>
            </div>
            {/* Net Balance Card */}
            <div className="analytics-card analytics-card-purple">
              <div className="analytics-card-title">Net Balance</div>
              <div className="analytics-card-value analytics-card-value-purple">
                {summary.net > 0 ? '+' : ''}{summary.net.toFixed(2)}
              </div>
            </div>
            {/* Most Frequent Payer Card */}
            <div className="analytics-card analytics-card-yellow">
              <div className="analytics-card-title">Most Frequent Payer</div>
              <div className="analytics-card-value analytics-card-value-yellow">{mostFrequentPayer}</div>
            </div>
          </div>
        </div>
      {/* Charts Section */}
      <div className="analytics-charts-grid">
        <div className="analytics-chart-card">
          <div className="analytics-chart-title">Group Expenses (Last 6 Months)</div>
          <div className="analytics-chart-inner">
            <ExpensesLineChart data={lineData} baseCurrency={baseCurrency} />
          </div>
        </div>
        <ExpenseBreakdownByCategory allExpenses={allExpenses} />
      </div>
      <div className="analytics-chart-card analytics-chart-card-full">
        <div className="analytics-chart-title">Member Contributions</div>
        <div className="analytics-chart-inner">
          <ContributionsBarChart data={barData} />
        </div>
      </div>
    </div>
    </PieModeContext.Provider>
  );
}

// New component for the pie chart section
function ExpenseBreakdownByCategory({ allExpenses }) {
  const { pieMode, setPieMode } = usePieMode();
  const [pieData, setPieData] = useState([]);
  const [baseCurrency] = useState('SGD'); // Use parent's baseCurrency if you want to sync
  const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });
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
    // Filter and aggregate pie data based on pieMode
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    let catAgg = {};
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
    if (pieMode === 'month') {
      allExpenses
        .filter(e => {
          const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        })
        .forEach(e => {
          let cat = e.category || 'Other';
          if (typeof cat === 'string') {
            cat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
          }
          catAgg[cat] = (catAgg[cat] || 0) + (typeof e.amount === 'number' ? convert(e.amount, e.currency) : 0);
        });
    } else {
      allExpenses.forEach(e => {
        let cat = e.category || 'Other';
        if (typeof cat === 'string') {
          cat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        }
        catAgg[cat] = (catAgg[cat] || 0) + (typeof e.amount === 'number' ? convert(e.amount, e.currency) : 0);
      });
    }
    setPieData(Object.entries(catAgg).map(([name, value]) => ({ name, value })));
  }, [allExpenses, pieMode, baseCurrency, exchangeRates]);
  return (
    <div className="analytics-chart-card">
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
      <div className="analytics-chart-inner">
        <CategoryPieChart data={pieData} />
      </div>
    </div>
  );
}