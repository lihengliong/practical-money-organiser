import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar
} from "recharts";
import { db, auth } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import './analytics.css';

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
  // Custom label to show category name and value
  const renderCustomizedLabel = ({ name, value, percent }) => {
    return `${name}: $${value.toFixed(2)} (${(percent * 100).toFixed(1)}%)`;
  };
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
          label={renderCustomizedLabel}
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

export default function Analytics() {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [lineData, setLineData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [barData, setBarData] = useState([]);
  const [baseCurrency] = useState('SGD'); // Replace with actual state/prop if you want to make it dynamic

  // Get current month name for display
  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      // 1. Fetch all groups the user is in
      const groupsSnapshot = await getDocs(query(collection(db, 'groups'), where('members', 'array-contains', user.email)));
      const groups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (!groups.length) {
        setLineData([]);
        setPieData([]);
        setBarData([]);
        setLoading(false);
        return;
      }
      // 2. Fetch all expenses for those groups
      let allExpenses = [];
      for (const group of groups) {
        const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', group.id)));
        allExpenses = allExpenses.concat(expensesSnapshot.docs.map(doc => ({ ...doc.data(), group })));
      }
      // 3. Calculate summary and chart data
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      // --- Summary Cards ---
      // Total group expenses this month
      const totalThisMonth = allExpenses
        .filter(e => {
          const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
        })
        .reduce((sum, e) => sum + (typeof e.amount === 'number' ? e.amount : 0), 0);
      // My personal contributions
      const myContributions = allExpenses
        .filter(e => e.paidBy === user.email)
        .reduce((sum, e) => sum + (typeof e.amount === 'number' ? e.amount : 0), 0);
      // Net balance (owes/owed)
      let net = 0;
      allExpenses.forEach(e => {
        if (!e.splits) return;
        if (e.paidBy === user.email) {
          e.splits.forEach(split => {
            if (split.member !== user.email) net += split.amountOwed;
          });
        } else if (e.splits.some(s => s.member === user.email)) {
          const userSplit = e.splits.find(s => s.member === user.email);
          net -= userSplit.amountOwed;
        }
      });
      // Most frequent payer
      const payerCounts = {};
      allExpenses.forEach(e => {
        if (!e.paidBy) return;
        payerCounts[e.paidBy] = (payerCounts[e.paidBy] || 0) + 1;
      });
      let mostFrequentPayer = '-';
      let maxCount = 0;
      Object.entries(payerCounts).forEach(([payer, count]) => {
        if (count > maxCount) {
          mostFrequentPayer = payer;
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
      allExpenses.forEach(e => {
        const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (monthMap[key]) {
          lineAgg[monthMap[key]] = (lineAgg[monthMap[key]] || 0) + (typeof e.amount === 'number' ? e.amount : 0);
        }
      });
      setLineData(months.map(m => ({ month: m, total: lineAgg[m] || 0 })));
      // --- Pie Chart: Expense breakdown by category (this month only) ---
      const catAgg = {};
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
          catAgg[cat] = (catAgg[cat] || 0) + (typeof e.amount === 'number' ? e.amount : 0);
        });
      setPieData(Object.entries(catAgg).map(([name, value]) => ({ name, value })));
      // --- Bar Chart: Member contributions ---
      const memberAgg = {};
      allExpenses.forEach(e => {
        if (!e.paidBy) return;
        memberAgg[e.paidBy] = (memberAgg[e.paidBy] || 0) + (typeof e.amount === 'number' ? e.amount : 0);
      });
      setBarData(Object.entries(memberAgg).map(([name, total]) => ({ name, total })));
      setLoading(false);
    })();
  }, [user]);

  if (!user) return <div className="p-8">Please log in to view analytics.</div>;
  if (loading) return <div className="p-8">Loading analytics...</div>;

  return (
    <div className="analytics-container">
      {/* Centralized Summary Cards Section */}
      <div className="analytics-summary-wrapper">
        <div className="analytics-summary-grid">
          {/* Total Group Expenses Card */}
          <div className="analytics-card analytics-card-blue">
            <div className="analytics-card-title">Total Group Expenses (This Month: {monthName})</div>
            <div className="analytics-card-value analytics-card-value-blue">$514.00</div>
          </div>
          {/* My Contributions Card */}
          <div className="analytics-card analytics-card-green">
            <div className="analytics-card-title">My Contributions</div>
            <div className="analytics-card-value analytics-card-value-green">$445.00</div>
          </div>
          {/* Net Balance Card */}
          <div className="analytics-card analytics-card-purple">
            <div className="analytics-card-title">Net Balance</div>
            <div className="analytics-card-value analytics-card-value-purple">+$240.25</div>
          </div>
          {/* Most Frequent Payer Card */}
          <div className="analytics-card analytics-card-yellow">
            <div className="analytics-card-title">Most Frequent Payer</div>
            <div className="analytics-card-value analytics-card-value-yellow">apple@gmail.com</div>
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
        <div className="analytics-chart-card">
          <div className="analytics-chart-title">Expense Breakdown by Category</div>
          <div className="analytics-chart-inner">
            <CategoryPieChart data={pieData} />
          </div>
        </div>
      </div>
      <div className="analytics-chart-card analytics-chart-card-full">
        <div className="analytics-chart-title">Member Contributions</div>
        <div className="analytics-chart-inner">
          <ContributionsBarChart data={barData} />
        </div>
      </div>
    </div>
  );
}