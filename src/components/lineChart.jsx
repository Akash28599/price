// src/components/CommodityPriceChart.jsx - ✅ INLINE PROXY (NO SEPARATE FILE)
import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceDot
} from 'recharts';
import { COMPLETE_WHEAT_DATA, COMPLETE_PALM_OIL_DATA } from './wheat';

const DAY = 24 * 60 * 60 * 1000;
const START_OF_YEAR = new Date('2025-01-01T00:00:00Z');
const WHEAT_BUSHEL_TO_KG = 27.2155;

// ✅ INLINE PROXY - Direct fetch from component
const fetchFuturesData = async (symbol, start, end) => {
  const apiUrl = `https://ds01.ddfplus.com/historical/queryeod.ashx?username=TolaramMR&password=replay&symbol=${symbol}&data=dailynearest&start=${start}&end=${end}`;
  
  // Try direct first (Vercel server-side works)
  try {
    const response = await fetch(apiUrl);
    if (response.ok) {
      const csvText = await response.text();
      return parseCSVData(csvText);
    }
  } catch {}

  // Fallback proxies
  const PROXIES = [
    'https://api.allorigins.win/get?url=',
    'https://corsproxy.io/?',
    'https://thingproxy.freeboard.io/fetch/'
  ];

  for (const proxy of PROXIES) {
    try {
      const fullUrl = proxy + encodeURIComponent(apiUrl);
      const response = await fetch(fullUrl);
      if (!response.ok) continue;
      
      if (proxy.includes('allorigins.win/get')) {
        const data = await response.json();
        return parseCSVData(data.contents);
      }
      return parseCSVData(await response.text());
    } catch {}
  }
  
  return [];
};

const parseCSVData = (csvText) => {
  const lines = csvText.trim().split('\n').filter(line => line.trim());
  const data = [];
  lines.forEach((line, index) => {
    if (index === 0) return;
    const cols = line.split(',');
    if (cols.length >= 7) {
      const dateStr = cols[1];
      const closePrice = parseFloat(cols[5]);
      if (!isNaN(closePrice) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        data.push({ date: dateStr, symbol: cols[0], close: closePrice / 100 });
      }
    }
  });
  return data;
};

// ✅ Custom Tooltip (unchanged)
const CustomTooltip = ({ active, payload, label, currency }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg min-w-[220px]">
        <div className="font-semibold text-gray-800 mb-3 text-sm">{label}</div>
        <div className="text-sm mb-2">
          <span className="font-medium text-gray-700">Excel Price:</span>{' '}
          <span className={`font-bold ${data.excelMissing ? 'text-red-600' : 'text-blue-600'}`}>
            {data.excelMissing 
              ? `Missing (${Number(data.excelInterpolated).toFixed(3)} ${currency}/kg)` 
              : `${Number(data.excelPrice).toFixed(3)} ${currency}/kg`}
          </span>
        </div>
        <div className="text-sm">
          <span className="font-medium text-gray-700">API Price:</span>{' '}
          <span className={`font-bold ${data.apiImputed ? 'text-orange-600' : 'text-green-600'}`}>
            {Number(data.apiPrice).toFixed(3)} {`${currency}/kg`}
          </span>
          {data.apiImputed && <span className="ml-1 text-xs text-orange-500">(prev)</span>}
        </div>
      </div>
    );
  }
  return null;
};

const CommodityPriceChart = () => {
  const [selectedCommodity, setSelectedCommodity] = useState('wheat');
  const [excelWeeklyData, setExcelWeeklyData] = useState([]);
  const [apiWeeklyData, setApiWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('Not loaded');
  const [ghsToUsdRate, setGhsToUsdRate] = useState(0.08);
  const [myrToGhs, setMyrToGhs] = useState(2.66);

  const excelData = selectedCommodity === 'wheat' ? COMPLETE_WHEAT_DATA : COMPLETE_PALM_OIL_DATA;
  const currency = selectedCommodity === 'wheat' ? 'USD' : 'GHS';

  // ---------- helpers (unchanged) ----------
  const getDateRange = (data) => {
    const dates = data.map(d => new Date(d.poDate + 'T00:00:00Z')).filter(d => !isNaN(d.getTime()));
    if (!dates.length) return { start: '20250101', end: '20251231' };
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    return {
      start: minDate.toISOString().slice(0, 10).replace(/-/g, ''),
      end: maxDate.toISOString().slice(0, 10).replace(/-/g, '')
    };
  };

  // ---------- FX rates (unchanged) ----------
  useEffect(() => {
    const fetchFxRates = async () => {
      try {
        const respGHSUSD = await fetch('https://api.exchangerate.host/latest?base=GHS&symbols=USD');
        const dataGHSUSD = await respGHSUSD.json();
        setGhsToUsdRate(dataGHSUSD.rates?.USD ?? 0.08);

        const respMYRGHS = await fetch('https://api.exchangerate.host/latest?base=MYR&symbols=GHS');
        const dataMYRGHS = await respMYRGHS.json();
        setMyrToGhs(dataMYRGHS.rates?.GHS ?? 2.66);
      } catch {
        setGhsToUsdRate(0.08);
        setMyrToGhs(2.66);
      }
    };
    fetchFxRates();
  }, []);

  // ---------- Excel weekly (unchanged) ----------
  const buildExcelWeekly = (rawData, rate) => {
    const weekly = {};
    rawData.forEach(entry => {
      const date = new Date(entry.poDate + 'T00:00:00Z');
      if (isNaN(date.getTime())) return;
      const weekNum = Math.floor((date - START_OF_YEAR) / (7 * DAY)) + 1;
      const key = `Week ${Math.max(1, weekNum)}`;
      if (!weekly[key]) weekly[key] = { rates: [], count: 0 };
      const usdRate = entry.currency === 'GHS' ? entry.rate * rate : entry.rate;
      weekly[key].rates.push(usdRate);
      weekly[key].count += 1;
    });

    return Object.entries(weekly)
      .map(([week, { rates, count }]) => ({
        week,
        excelPrice: parseFloat((rates.reduce((a,b)=>a+b,0) / rates.length).toFixed(3)),
        count
      }))
      .sort((a,b) => parseInt(a.week.replace('Week ', ''), 10) - parseInt(b.week.replace('Week ', ''), 10));
  };

  useEffect(() => {
    if (ghsToUsdRate > 0) {
      const weeklyData = buildExcelWeekly(excelData, ghsToUsdRate);
      setExcelWeeklyData(weeklyData);
    }
  }, [selectedCommodity, ghsToUsdRate, excelData]);

  // ---------- ✅ INLINE PROXY FETCH ----------
  useEffect(() => {
    const fetchData = async () => {
      if (excelWeeklyData.length === 0) return;
      setLoading(true);
      setApiStatus('🔄 Fetching...');
      
      const { start, end } = getDateRange(excelData);
      const symbol = selectedCommodity === 'wheat' ? 'ZW*1' : 'KO*1';
      
      const rawData = await fetchFuturesData(symbol, start, end);
      
      if (rawData.length > 0) {
        const grouped = {};
        rawData.forEach(r => {
          const date = new Date(r.date + 'T00:00:00Z');
          if (isNaN(date.getTime())) return;
          const weekNum = Math.floor((date - START_OF_YEAR) / (7 * DAY)) + 1;
          const key = `Week ${Math.max(1, weekNum)}`;
          if (!grouped[key]) grouped[key] = [];
          
          let kgPrice;
          if (selectedCommodity === 'wheat') {
            kgPrice = r.close / WHEAT_BUSHEL_TO_KG;
          } else {
            kgPrice = (r.close / 1000) * myrToGhs;
          }
          grouped[key].push(kgPrice);
        });

        const apiData = Object.entries(grouped)
          .map(([week, prices]) => ({
            week,
            apiPrice: parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(3))
          }))
          .sort((a, b) => parseInt(a.week.replace('Week ', ''), 10) - parseInt(b.week.replace('Week ', ''), 10));

        setApiWeeklyData(apiData);
        setApiStatus(`✅ ${rawData.length} rows (${symbol})`);
      } else {
        setApiStatus('❌ API failed');
      }
      setLoading(false);
    };
    fetchData();
  }, [excelWeeklyData, selectedCommodity, excelData, myrToGhs]);

  // ---------- Chart data + rest unchanged ----------
  const chartData = useMemo(() => {
    const excelMap = new Map(excelWeeklyData.map(d => [parseInt(d.week.replace('Week ', ''), 10), { price: d.excelPrice, count: d.count }]));
    const apiMap = new Map(apiWeeklyData.map(d => [parseInt(d.week.replace('Week ', ''), 10), d.apiPrice]));

    const allWeekNums = new Set([...excelMap.keys(), ...apiMap.keys()]);
    const sortedWeekNums = Array.from(allWeekNums).sort((a,b)=>a-b);
    if (!sortedWeekNums.length) return [];

    const minWeek = Math.min(...sortedWeekNums);
    const maxWeek = Math.max(...sortedWeekNums);

    const findPrevExcel = (wk) => {
      for (let i = wk - 1; i >= minWeek; i--) {
        if (excelMap.has(i) && excelMap.get(i).price != null) {
          return { weekNum: i, price: excelMap.get(i).price };
        }
      }
      return null;
    };

    let lastApiPrice = null;
    const rows = [];
    for (let wk = minWeek; wk <= maxWeek; wk++) {
      const weekKey = `Week ${wk}`;
      const excelEntry = excelMap.has(wk) ? excelMap.get(wk) : null;
      const excelPrice = excelEntry ? excelEntry.price : null;
      const excelCount = excelEntry ? excelEntry.count : 0;

      let excelInterpolated = excelPrice;
      if (excelPrice == null) {
        const prev = findPrevExcel(wk);
        excelInterpolated = prev ? prev.price : null;
      }

      const apiEntry = apiMap.has(wk) ? apiMap.get(wk) : null;
      let apiPrice = apiEntry != null ? apiEntry : lastApiPrice;
      const apiImputed = apiEntry == null && apiPrice != null;
      if (apiEntry != null) lastApiPrice = apiEntry;

      rows.push({
        week: weekKey,
        weekNum: wk,
        excelPrice,
        excelInterpolated,
        excelCount,
        excelMissing: excelPrice == null,
        apiPrice,
        apiImputed,
        apiHasRealValue: apiEntry != null
      });
    }
    return rows;
  }, [excelWeeklyData, apiWeeklyData]);

  const redPointsFull = chartData.filter(d => d.excelMissing && d.excelInterpolated != null).map(d => ({
    week: d.week, y: d.excelInterpolated, excelCount: d.excelCount
  }));

  const orangePointsFull = chartData.filter(d => d.apiImputed && d.apiPrice != null).map(d => ({
    week: d.week, y: d.apiPrice
  }));

  const ExcelDot = (props) => {
    const { cx, cy, payload } = props;
    if (!payload || payload.excelPrice == null) return null;
    return <rcle cx={cx} cy={cy} r={4} fill="#3B82F6" stroke="#fff" strokeWidth={1} />;
  };

  const yAxisLabel = `${currency}/kg`;
  const chartHeader = selectedCommodity === 'palm' ? '🌴 Palm Oil (GHS/kg)' : '🌾 Wheat Flour (USD/kg)';

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{chartHeader}</h1>
          <div className="text-sm text-gray-600 mt-1">
            {selectedCommodity === 'palm' ? `💱 1 MYR=${myrToGhs.toFixed(4)} GHS` : `💱 1 GHS=${ghsToUsdRate.toFixed(4)} USD`} | 📅 {getDateRange(excelData).start}-{getDateRange(excelData).end} | {apiStatus}
          </div>
        </div>
        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" value={selectedCommodity} onChange={e => setSelectedCommodity(e.target.value)}>
          <option value="wheat">🌾 Wheat Flour (ZW*1)</option>
          <option value="palm">🌴 Palm Oil (KO*1)</option>
        </select>
      </div>

      <ResponsiveContainer width="100%" height={520}>
        <LineChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 90 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" angle={-45} height={100} tick={{ fontSize: 11 }} interval={Math.floor(chartData.length / 12) || 0} />
          <YAxis domain={[0, 'auto']} label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
          <Tooltip content={<CustomTooltip currency={currency} />} cursor={{ strokeDasharray: '3 3' }} />
          <Legend />
          <Line type="monotone" dataKey="excelInterpolated" stroke="#3B82F6" strokeWidth={3} name="Excel Price" connectNulls={true} dot={ExcelDot} isAnimationActive={false} />
          <Line type="monotone" dataKey="apiPrice" stroke="#10B981" strokeWidth={3} name="API Price" connectNulls={true} dot={false} isAnimationActive={false} />
          {redPointsFull.map((p, i) => (
            <ReferenceDot key={`red-${i}`} x={p.week} y={p.y} r={6} fill="#EF4444" stroke="#fff" strokeWidth={2} isFront={true} />
          ))}
          {orangePointsFull.map((p, i) => (
            <ReferenceDot key={`orange-${i}`} x={p.week} y={p.y} r={6} fill="#F97316" stroke="#fff" strokeWidth={2} isFront={true} />
          ))}
        </LineChart>
      </ResponsiveContainer>

      

    </div>
  );
};

export default CommodityPriceChart;
