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
import { useLocation, useNavigate } from 'react-router-dom';

const pieColors = ["#3b82f6", "#10b981", "#f59e42", "#a78bfa", "#f43f5e", "#6366f1", "#fbbf24", "#ef4444"];

function ExpensesLineChart({ data, baseCurrency }) {
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
        <defs>
          <linearGradient id="colorLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.7}/>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={renderCustomTick} interval={0} />
        <YAxis label={{ value: baseCurrency, angle: -90, position: 'insideLeft', offset: 10, fontSize: 14, fill: '#64748b' }} tick={{ fill: '#64748b', fontWeight: 600, fontSize: 14 }} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, boxShadow: '0 4px 24px #3b82f622', border: 'none', background: '#fff' }} labelStyle={{ color: '#2563eb', fontWeight: 700 }} />
        <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={4} dot={{ r: 7, fill: '#fff', stroke: '#3b82f6', strokeWidth: 3, filter: 'drop-shadow(0 2px 8px #3b82f633)' }} activeDot={{ r: 10, fill: '#3b82f6', stroke: '#fff', strokeWidth: 3 }} fill="url(#colorLine)" />
        {/* Area for subtle gradient fill under the line */}
        <area type="monotone" dataKey="total" stroke={false} fill="url(#colorLine)" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CategoryPieChart({ data }) {
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

const PieModeContext = createContext();
export function usePieMode() {
  return useContext(PieModeContext);
}

// GroupHeader component for group name and members
function GroupHeader({ group }) {
  // Helper for member initials
  const getInitials = (nameOrEmail) => {
    if (!nameOrEmail) return '';
    const parts = nameOrEmail.split(/[@.\s]/).filter(Boolean);
    return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
  };
  const members = group?.memberProfiles || (group?.members ? group.members.map(email => ({ email, displayName: email })) : []);
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', marginBottom: 18, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 48, fontWeight: 900, color: '#2563eb', marginBottom: 8, letterSpacing: '-1.5px' }}>{group?.name || 'Group'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {members.map((m, idx) => (
          <span key={m.email || m} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e6f4ea', borderRadius: 16, padding: '3px 12px', fontSize: 16, fontWeight: 500, color: '#388e3c', marginRight: 4 }}>
            <span style={{ background: '#fff', color: '#388e3c', borderRadius: '50%', width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, marginRight: 4, boxShadow: '0 1px 4px #b7e4c7aa' }}>{getInitials(m.displayName || m.email || m)}</span>
            {m.displayName || m.email || m}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function GroupAnalytics() {
  const location = useLocation();
  const group = location.state?.group;
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [lineData, setLineData] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [barData, setBarData] = useState([]);
  const [baseCurrency, setBaseCurrency] = useState('SGD');
  const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });
  const now = new Date();
  const [pieMode, setPieMode] = useState('month');
  const navigate = useNavigate();
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
    if (!user || !group) return;
    setLoading(true);
    (async () => {
      // Only fetch expenses for this group
      const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', group.id)));
      const allExpensesArr = expensesSnapshot.docs.map(doc => ({ ...doc.data(), group }));
      // --- Summary Cards ---
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
      // Total group expenses (all time)
      const totalGroupExpenses = allExpensesArr.reduce((sum, e) => sum + (typeof e.amount === 'number' ? convert(e.amount, e.currency) : 0), 0);
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
        const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
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
      setSummary({
        totalThisMonth,
        totalGroupExpenses,
        myContributions,
        net,
        mostFrequentPayer: mostFrequentPayerCalc
      });
      setAllExpenses(allExpensesArr);
      setLoading(false);
    })();
  }, [user, baseCurrency, exchangeRates, group]);

  const [summary, setSummary] = useState({ totalThisMonth: 0, totalGroupExpenses: 0, myContributions: 0, net: 0, mostFrequentPayer: '-' });

  if (!user) return <div className="p-8">Please log in to view analytics.</div>;
  if (loading) return <div className="p-8">Loading analytics...</div>;

  // Helper for member initials
  const getInitials = (nameOrEmail) => {
    if (!nameOrEmail) return '';
    const parts = nameOrEmail.split(/[@.\s]/).filter(Boolean);
    return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
  };
  // Get member list (with fallback)
  const members = group?.memberProfiles || (group?.members ? group.members.map(email => ({ email, displayName: email })) : []);

  return (
    <PieModeContext.Provider value={{ pieMode, setPieMode }}>
      <div className="analytics-container">
        {/* Back button and group header, aligned with stats */}
        <div style={{ maxWidth: 1200, margin: '0 auto', marginBottom: 8 }}>
          <button onClick={() => navigate(-1)} style={{ background: '#f1f1f1', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, cursor: 'pointer', color: '#333', boxShadow: '0 1px 4px #b7e4c7aa', marginBottom: 10 }}>
            ← Back to Group Expenses
          </button>
          <GroupHeader group={group} />
        </div>
        {/* Centralized Summary Cards Section */}
        <div className="analytics-summary-wrapper">
          <div className="analytics-summary-grid">
            {/* Group Total Expenses Card */}
            <div className="analytics-card analytics-card-blue">
              <div className="analytics-card-title">Total Expenses Incurred by Group</div>
              <div className="analytics-card-value analytics-card-value-blue">${summary.totalGroupExpenses ? summary.totalGroupExpenses.toFixed(2) : '0.00'}</div>
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
              <div className="analytics-card-value analytics-card-value-yellow">
                {(() => {
                  // Try to find display name for most frequent payer
                  const members = group?.memberProfiles || (group?.members ? group.members.map(email => ({ email, displayName: email })) : []);
                  const found = members.find(m => m.email === summary.mostFrequentPayer || m.displayName === summary.mostFrequentPayer);
                  return found ? (found.displayName || found.email) : summary.mostFrequentPayer;
                })()}
              </div>
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
      {/* Recent Expenses List */}
      <div className="analytics-chart-card analytics-chart-card-full" style={{ marginTop: 32 }}>
        <div className="analytics-chart-title">Recent Expenses</div>
        {allExpenses.length === 0 ? (
          <div style={{ color: '#888', fontSize: 17, padding: 24, textAlign: 'center' }}>
            No expenses yet for this group!
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#2563eb', fontWeight: 700 }}>
                <td style={{ padding: '10px 8px' }}>Date</td>
                <td style={{ padding: '10px 8px' }}>Description</td>
                <td style={{ padding: '10px 8px' }}>Category</td>
                <td style={{ padding: '10px 8px' }}>Paid By</td>
                <td style={{ padding: '10px 8px' }}>Amount</td>
              </tr>
            </thead>
            <tbody>
              {allExpenses
                .slice()
                .sort((a, b) => {
                  const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                  const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                  return bDate - aDate;
                })
                .map((e, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 8px' }}>{e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString() : ''}</td>
                    <td style={{ padding: '8px 8px' }}>{e.description}</td>
                    <td style={{ padding: '8px 8px' }}>{e.category || 'Other'}</td>
                    <td style={{ padding: '8px 8px' }}>{e.paidBy}</td>
                    <td style={{ padding: '8px 8px', fontWeight: 600 }}>${e.amount?.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
    </PieModeContext.Provider>
  );
}

function ExpenseBreakdownByCategory({ allExpenses }) {
  const { pieMode, setPieMode } = usePieMode();
  const [pieData, setPieData] = useState([]);
  const [baseCurrency] = useState('SGD');
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