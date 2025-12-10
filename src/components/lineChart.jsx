// src/components/CommodityPriceChart.jsx - ✅ DIRECT API FIRST, PROXY FALLBACK
import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceDot
} from 'recharts';
import { 
  COMPLETE_WHEAT_DATA, COMPLETE_PALM_OIL_DATA, 
  ALUMINIUM_MONTH_COST, SUGAR_MONTH_COST 
} from './wheat';

// Conversion factors
const WHEAT_BUSHEL_TO_KG = 27.2155;
const SUGAR_CONTRACT_TO_KG = 112000 * 0.453592;
const ALUMINIUM_MT_TO_KG = 1000;

// API Symbols
const SYMBOLS = {
  'wheat-zw': 'ZW*1',
  'wheat-ml': 'ML*1',
  'aluminum': 'AL*1',
  'sugar': 'SB*1',
  'palm': 'KO*1'
};

// ✅ DIRECT API FIRST, then PROXY FALLBACK
const fetchFuturesData = async (symbol, start, end) => {
  const apiUrl = `https://ds01.ddfplus.com/historical/queryeod.ashx?username=TolaramMR&password=replay&symbol=${symbol}&data=monthly&start=${start}&end=${end}`;
  
  // ✅ 1. TRY DIRECT API FIRST (works on Vercel)
  try {
    const response = await fetch(apiUrl);
    if (response.ok) {
      const csvText = await response.text();
      return parseCSVData(csvText);
    }
  } catch {}

  // ✅ 2. FALLBACK TO PROXIES (local dev)
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

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg min-w-[220px]">
        <div className="font-semibold text-gray-800 mb-3 text-sm">{label}</div>
        <div className="text-sm mb-2">
          <span className="font-medium text-blue-700">📊 Buy Price (Excel):</span>{' '}
          <span className={`font-bold ${data.excelMissing ? 'text-red-600' : 'text-blue-600'}`}>
            {data.excelMissing 
              ? `Missing (${Number(data.excelInterpolated).toFixed(2)} ${currency}/kg)` 
              : `${Number(data.excelPrice).toFixed(2)} ${currency}/kg`}
          </span>
        </div>
        <div className="text-sm">
          <span className="font-medium text-green-700">📈 Market Price (API):</span>{' '}
          <span className={`font-bold ${data.apiImputed ? 'text-orange-600' : 'text-green-600'}`}>
            {Number(data.apiPrice).toFixed(2)} {`${currency}/kg`}
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
  const [selectedWheatType, setSelectedWheatType] = useState('zw');
  const [excelMonthlyData, setExcelMonthlyData] = useState([]);
  const [apiMonthlyData, setApiMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('Not loaded');

  const getCurrencyConfig = () => {
    const config = {
      wheat: { currency: 'USD', usdToNg: 1 },
      palm: { currency: 'GHS', usdToNg: 1 },
      aluminum: { currency: 'NGN', usdToNg: 1650 },
      sugar: { currency: 'NGN', usdToNg: 1650 }
    };
    return config[selectedCommodity] || config.wheat;
  };

  const currencyConfig = getCurrencyConfig();
  const currentSymbolKey = selectedCommodity === 'wheat' ? `wheat-${selectedWheatType}` : selectedCommodity;

  const getExcelData = () => {
    switch(selectedCommodity) {
      case 'wheat': return COMPLETE_WHEAT_DATA;
      case 'aluminum': return ALUMINIUM_MONTH_COST;
      case 'sugar': return SUGAR_MONTH_COST;
      case 'palm': return COMPLETE_PALM_OIL_DATA;
      default: return [];
    }
  };

  const excelData = getExcelData();

  const formatMonthLabel = (month) => {
    const date = new Date(month + '-01');
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const buildExcelMonthly = (rawData) => {
    const monthly = {};
    
    rawData.forEach(entry => {
      let monthKey;
      if (entry.poDate) {
        const date = new Date(entry.poDate + 'T00:00:00Z');
        if (!isNaN(date.getTime())) {
          monthKey = date.toISOString().slice(0, 7);
        }
      } else if (entry.month) {
        const [monthPart, yearPart] = entry.month.split('-');
        monthKey = `20${yearPart.padStart(2, '0')}-${monthPart.padStart(2, '0')}`;
      }
      
      if (!monthKey) return;
      
      if (!monthly[monthKey]) monthly[monthKey] = { rates: [], count: 0 };
      const price = entry.rate || entry.cost || 0;
      if (price > 0 && !isNaN(price)) {
        monthly[monthKey].rates.push(price);
        monthly[monthKey].count += 1;
      }
    });

    return Object.entries(monthly)
      .filter(([, data]) => data.rates.length > 0)
      .map(([month, { rates, count }]) => ({
        month,
        excelPrice: parseFloat((rates.reduce((a,b)=>a+b,0) / rates.length).toFixed(2)),
        count
      }))
      .sort((a,b) => new Date(a.month) - new Date(b.month));
  };

  useEffect(() => {
    const monthlyData = buildExcelMonthly(excelData);
    setExcelMonthlyData(monthlyData);
  }, [selectedCommodity]);

  useEffect(() => {
    const fetchData = async () => {
      if (excelMonthlyData.length === 0) return;
      setLoading(true);
      setApiStatus('🔄 Direct API → Proxy...');
      
      const start = '20240101';
      const end = '20251231';
      
      const symbol = SYMBOLS[currentSymbolKey];
      const rawData = await fetchFuturesData(symbol, start, end);
      
      if (rawData.length > 0) {
        const grouped = {};
        rawData.forEach(r => {
          const monthKey = r.date.slice(0, 7);
          if (!grouped[monthKey]) grouped[monthKey] = [];
          
          let kgPrice;
          switch(selectedCommodity) {
            case 'wheat':
              kgPrice = r.close / WHEAT_BUSHEL_TO_KG;
              break;
            case 'aluminum':
              kgPrice = (r.close / ALUMINIUM_MT_TO_KG) * currencyConfig.usdToNg;
              break;
            case 'sugar':
              kgPrice = (r.close / SUGAR_CONTRACT_TO_KG) * currencyConfig.usdToNg;
              break;
            case 'palm':
              kgPrice = (r.close / 1000) * 2.66;
              break;
            default:
              kgPrice = r.close;
          }
          grouped[monthKey].push(kgPrice);
        });

        const apiData = Object.entries(grouped)
          .map(([month, prices]) => ({
            month,
            apiPrice: parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2))
          }))
          .sort((a, b) => new Date(a.month) - new Date(b.month));

        setApiMonthlyData(apiData);
        setApiStatus(`✅ ${rawData.length} rows (${symbol})`);
      } else {
        setApiStatus('❌ Direct+Proxy failed');
      }
      setLoading(false);
    };
    fetchData();
  }, [excelMonthlyData, selectedCommodity, selectedWheatType, currencyConfig]);

  const chartData = useMemo(() => {
    const excelMonths = new Set(excelMonthlyData.map(d => d.month));
    const apiMap = new Map(apiMonthlyData.map(d => [d.month, d.apiPrice]));
    const sortedExcelMonths = Array.from(excelMonths).sort();

    if (!sortedExcelMonths.length) return [];

    const excelMap = new Map(excelMonthlyData.map(d => [d.month, { price: d.excelPrice, count: d.count }]));

    const findPrevExcel = (month) => {
      const monthDate = new Date(month + '-01');
      for (let i = 1; i < 12; i++) {
        const prevMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - i, 1);
        const prevKey = prevMonth.toISOString().slice(0, 7);
        if (excelMap.has(prevKey)) {
          return { month: prevKey, price: excelMap.get(prevKey).price };
        }
      }
      return null;
    };

    let lastApiPrice = null;
    return sortedExcelMonths.map(month => {
      const excelEntry = excelMap.get(month);
      const excelPrice = excelEntry ? excelEntry.price : null;
      const excelCount = excelEntry ? excelEntry.count : 0;

      let excelInterpolated = excelPrice;
      if (excelPrice == null) {
        const prev = findPrevExcel(month);
        excelInterpolated = prev ? prev.price : null;
      }

      const apiEntry = apiMap.get(month);
      let apiPrice = apiEntry != null ? apiEntry : lastApiPrice;
      const apiImputed = apiEntry == null && apiPrice != null;
      if (apiEntry != null) lastApiPrice = apiEntry;

      return {
        month,
        excelPrice,
        excelInterpolated,
        excelCount,
        excelMissing: excelPrice == null,
        apiPrice,
        apiImputed,
        apiHasRealValue: apiEntry != null
      };
    });
  }, [excelMonthlyData, apiMonthlyData]);

  const redPoints = chartData.filter(d => d.excelMissing && d.excelInterpolated != null);
  const orangePoints = chartData.filter(d => d.apiImputed && d.apiPrice != null);

  const getTitle = () => {
    const titles = {
      wheat: '🌾 Wheat Flour',
      aluminum: '⚙️ Aluminum', 
      sugar: '🍬 Sugar',
      palm: '🌴 Palm Oil'
    };
    return `${titles[selectedCommodity] || selectedCommodity} (${currencyConfig.currency}/kg)`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white rounded-xl shadow-lg">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{getTitle()}</h1>
          <div className="text-sm text-gray-600 mt-1">
            📅 {excelMonthlyData[0]?.month || 'No data'} - {excelMonthlyData[excelMonthlyData.length-1]?.month || 'No data'} | {apiStatus}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <select 
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={selectedCommodity} 
            onChange={e => {
              setSelectedCommodity(e.target.value);
              if (e.target.value !== 'wheat') setSelectedWheatType('zw');
            }}
          >
            <option value="wheat">🌾 Wheat (USD/kg)</option>
            <option value="palm">🌴 Palm Oil (GHS/kg)</option>
            <option value="aluminum">⚙️ Aluminum (NGN/kg)</option>
            <option value="sugar">🍬 Sugar (NGN/kg)</option>
          </select>
          
          {selectedCommodity === 'wheat' && (
            <select 
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={selectedWheatType}
              onChange={e => setSelectedWheatType(e.target.value)}
            >
              <option value="zw">ZW Wheat</option>
              <option value="ml">ML Wheat</option>
            </select>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={520}>
        <LineChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 90 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month" 
            angle={-45} 
            height={100} 
            tick={{ fontSize: 11 }} 
            interval={Math.floor(chartData.length / 8) || 0}
            tickFormatter={formatMonthLabel}
          />
          <YAxis 
            label={{ 
              value: `${currencyConfig.currency}/kg`, 
              angle: -90, 
              position: 'insideLeft'
            }} 
          />
          <Tooltip 
            content={<CustomTooltip currency={currencyConfig.currency} />} 
            cursor={{ strokeDasharray: '3 3' }}
            labelFormatter={formatMonthLabel}
          />
          <Legend />
          
          <Line 
            type="monotone" 
            dataKey="excelInterpolated" 
            stroke="#3B82F6" 
            strokeWidth={3} 
            name="🛒 Buy Price (Excel)" 
            connectNulls={true}
            isAnimationActive={false} 
          />
          <Line 
            type="monotone" 
            dataKey="apiPrice" 
            stroke="#10B981" 
            strokeWidth={3} 
            name={`📈 Market Price (${SYMBOLS[currentSymbolKey]})`} 
            connectNulls={true}
            isAnimationActive={false} 
          />
          
          {redPoints.map((p, i) => (
            <ReferenceDot 
              key={`red-${i}`} 
              x={p.month} 
              y={p.excelInterpolated} 
              r={6} 
              fill="#EF4444" 
              stroke="#fff" 
              strokeWidth={2} 
              isFront={true} 
            />
          ))}
          {orangePoints.map((p, i) => (
            <ReferenceDot 
              key={`orange-${i}`} 
              x={p.month} 
              y={p.apiPrice} 
              r={6} 
              fill="#F97316" 
              stroke="#fff" 
              strokeWidth={2} 
              isFront={true} 
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CommodityPriceChart;
