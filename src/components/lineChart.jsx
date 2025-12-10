// CommodityPriceChart.jsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  COMPLETE_WHEAT_DATA, COMPLETE_PALM_OIL_DATA,
  SUGAR_MONTH_COST
} from './wheat';

// ---------- FX & unit constants (adjust if you want live rates) ----------
const FX = {
  USD_to_GHS: 11.44,     // 1 USD => 11.44 GHS (example)
  USD_to_NGN: 1451.6,    // 1 USD => 1451.6 NGN
  EUR_to_USD: 1.1637,    // 1 EUR => 1.1637 USD
  MYR_to_USD: 0.2430     // 1 MYR => 0.2430 USD
};
const MYR_to_GHS = FX.MYR_to_USD * FX.USD_to_GHS;

// unit conversions
const BUSHEL_TO_KG_WHEAT = 27.2155; // 1 bushel wheat ≈ 27.2155 kg
const TONNE_TO_KG = 1000;
const LB_TO_KG = 0.45359237;

// ---------- RAW FALLBACK DATA (use your CSV/contract close values) ----------
const RAW_FALLBACK_DATA = {
  'wheat-zw': [
    { month: '2024-11', raw: 593 }, { month: '2024-12', raw: 598.5 },
    { month: '2025-01', raw: 617 }, { month: '2025-02', raw: 604.5 },
    { month: '2025-03', raw: 589.25 }, { month: '2025-04', raw: 568.25 },
    { month: '2025-05', raw: 571 }, { month: '2025-06', raw: 560 },
    { month: '2025-07', raw: 542.5 }, { month: '2025-08', raw: 534.25 },
    { month: '2025-09', raw: 508 }, { month: '2025-10', raw: 534 },
    { month: '2025-11', raw: 531 }, { month: '2025-12', raw: 536.25 }
  ],
  'wheat-ml': [
    { month: '2024-09', raw: 234.75 }, { month: '2024-10', raw: 232 },
    { month: '2024-11', raw: 222.25 }, { month: '2024-12', raw: 233.75 },
    { month: '2025-01', raw: 232.75 }, { month: '2025-02', raw: 236.75 },
    { month: '2025-03', raw: 226 }, { month: '2025-04', raw: 214.75 },
    { month: '2025-05', raw: 212.25 }, { month: '2025-06', raw: 206.5 },
    { month: '2025-07', raw: 202.5 }, { month: '2025-08', raw: 194 },
    { month: '2025-09', raw: 186.25 }, { month: '2025-10', raw: 193 },
    { month: '2025-11', raw: 187.25 }, { month: '2025-12', raw: 190 }
  ],
  palm: [
    { month: '2024-12', raw: 4112 }, { month: '2025-01', raw: 4100 },
    { month: '2025-02', raw: 4310 }, { month: '2025-03', raw: 4196 },
    { month: '2025-04', raw: 3920 }, { month: '2025-05', raw: 3888 },
    { month: '2025-06', raw: 4009 }, { month: '2025-07', raw: 4260 },
    { month: '2025-08', raw: 4408 }, { month: '2025-09', raw: 4352 },
    { month: '2025-10', raw: 4193 }, { month: '2025-11', raw: 4077 },
    { month: '2025-12', raw: 4031 }
  ],
  sugar: [
    { month: '2024-11', raw: 19.06 }, { month: '2024-12', raw: 17.7 },
    { month: '2025-01', raw: 18.02 }, { month: '2025-02', raw: 18.59 },
    { month: '2025-03', raw: 19.2 }, { month: '2025-04', raw: 17.82 },
    { month: '2025-05', raw: 17.69 }, { month: '2025-06', raw: 16.94 },
    { month: '2025-07', raw: 16.97 }, { month: '2025-08', raw: 17.01 },
    { month: '2025-09', raw: 16.6 }, { month: '2025-10', raw: 14.43 },
    { month: '2025-11', raw: 15.21 }, { month: '2025-12', raw: 14.67 },
    {month:'2024-10',raw:19.82}
  ]
};

// ---------- robust normalizeMonth to 'YYYY-MM' ----------
function normalizeMonth(value) {
  if (!value) return null;
  value = String(value).trim();
  const ymdShort = value.match(/^(\d{4})-(\d{2})$/);
  if (ymdShort) return `${ymdShort[1]}-${ymdShort[2]}`;
  const ymd = value.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}`;
  const mShort = value.match(/^([A-Za-z]{3})[-\/](\d{2,4})$/);
  if (mShort) {
    const mon = mShort[1];
    let yr = mShort[2];
    if (yr.length === 2) yr = `20${yr}`;
    const monthNames = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
      Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    if (monthNames[mon]) return `${yr}-${monthNames[mon]}`;
  }
  const mLong = value.match(/^([A-Za-z]+)\s+(\d{2,4})$/);
  if (mLong) {
    const mon = mLong[1].slice(0,3);
    let yr = mLong[2];
    if (yr.length === 2) yr = `20${yr}`;
    const monthNames = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
      Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    if (monthNames[mon]) return `${yr}-${monthNames[mon]}`;
  }
  const d = new Date(value);
  if (!isNaN(d)) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return null;
}

// ---------- convert API raw -> target units ----------
// Targets:
//  wheat => USD/kg
//  palm  => GHS/kg
//  sugar => NGN/kg
function convertApiValue(commodity, wheatType, rawValue) {
  if (rawValue == null || isNaN(Number(rawValue))) return null;
  const rv = Number(rawValue);

  if (commodity === 'wheat') {
    if (wheatType === 'zw') {
      // ZW: cents per bushel -> USD per bushel -> USD/kg
      const usd_per_bushel = rv / 100;
      return usd_per_bushel / BUSHEL_TO_KG_WHEAT;
    } else {
      // ML: EUR per tonne -> EUR/kg -> USD/kg
      const eur_per_kg = rv / TONNE_TO_KG;
      return eur_per_kg * FX.EUR_to_USD;
    }
  }

  if (commodity === 'palm') {
    // KO: MYR per tonne -> MYR/kg -> GHS/kg
    const myr_per_kg = rv / TONNE_TO_KG;
    return myr_per_kg * MYR_to_GHS;
  }

  if (commodity === 'sugar') {
    // SB: cents per lb -> USD/lb -> USD/kg -> NGN/kg
    const usd_per_lb = rv / 100;
    const usd_per_kg = usd_per_lb / LB_TO_KG;
    return usd_per_kg * FX.USD_to_NGN;
  }

  return null;
}

// ---------- buildExcelMonthly (plain function) ----------
function buildExcelMonthly(rawDataArray) {
  if (!Array.isArray(rawDataArray)) return [];
  const bucket = new Map();
  rawDataArray.forEach(entry => {
    const rawMonth = entry.month || entry.poDate || entry.date || entry.m || '';
    const monthKey = normalizeMonth(rawMonth);
    if (!monthKey) return;
    const price = Number(entry.cost ?? entry.rate ?? entry.excelPrice ?? entry.close ?? 0);
    if (!price || isNaN(price)) return;
    if (!bucket.has(monthKey)) bucket.set(monthKey, []);
    bucket.get(monthKey).push(price);
  });

  return Array.from(bucket.entries()).map(([month, prices]) => ({
    month,
    excelPrice: parseFloat((prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(6))
  })).sort((a,b)=> new Date(a.month + '-01') - new Date(b.month + '-01'));
}

// ---------- Component ----------
const CommodityPriceChart = () => {
  const [selectedCommodity, setSelectedCommodity] = useState('sugar');
  const [selectedWheatType, setSelectedWheatType] = useState('zw');
  const [precomputed, setPrecomputed] = useState({ wheat: [], palm: [], sugar: [] });

  useEffect(() => {
    const wheatMonthly = buildExcelMonthly(COMPLETE_WHEAT_DATA || []);
    const palmMonthly = buildExcelMonthly(COMPLETE_PALM_OIL_DATA || []);

    // <-- AGGREGATE SUGAR MONTH COST using the same helper so duplicates removed -->
    const sugarRowsForBuild = (SUGAR_MONTH_COST || []).map(e => ({ month: e.month, cost: e.cost }));
    const sugarMonthly = buildExcelMonthly(sugarRowsForBuild);

    setPrecomputed({ wheat: wheatMonthly, palm: palmMonthly, sugar: sugarMonthly });
  }, []);

  const excelData = precomputed[selectedCommodity] || [];
  const apiKey = selectedCommodity === 'wheat' ? `wheat-${selectedWheatType}` : selectedCommodity;
  const rawApiList = RAW_FALLBACK_DATA[apiKey] || [];

  const rawMap = useMemo(() => {
    const m = new Map();
    rawApiList.forEach(r => {
      const mm = normalizeMonth(r.month);
      if (mm) m.set(mm, r.raw);
    });
    return m;
  }, [rawApiList]);

  // chartData includes raw and converted values plus diff and pctDiff
  const chartData = useMemo(() => {
    return excelData.map(d => {
      const raw = rawMap.get(d.month);
      const converted = raw != null ? convertApiValue(selectedCommodity, selectedWheatType, raw) : null;
      const excel = d.excelPrice;
      let diff = null;
      let pctDiff = null;
      if (converted != null && !isNaN(converted)) {
        diff = Number((excel - converted).toFixed(6));
        pctDiff = converted !== 0 ? Number(((excel - converted) / Math.abs(converted) * 100).toFixed(2)) : null;
      }
      return {
        month: d.month,
        excelPrice: excel,
        rawApi: raw != null ? Number(raw) : null,
        marketPrice: converted != null ? Number(converted) : null,
        diff,
        pctDiff
      };
    }).filter(Boolean);
  }, [excelData, rawMap, selectedCommodity, selectedWheatType]);

  // decimals per commodity for display
  const decimalsPerCommodity = { wheat: 3, palm: 2, sugar: 0 };
  const axisUnit = { wheat: 'USD/kg', palm: 'GHS/kg', sugar: 'NGN/kg' };
  const currencyCode = { wheat: 'USD', palm: 'GHS', sugar: 'NGN' };

  // Custom tooltip uses decimalsPerCommodity
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const d = payload[0].payload;
    const prettyMonth = new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const decs = decimalsPerCommodity[selectedCommodity] ?? 2;
    const fmt = (v, commodity) => (v == null || isNaN(v)) ? '—' : `${Number(v).toFixed(decs)} ${currencyCode[commodity]}`;

    return (
      <div style={{ background: 'white', padding: 12, borderRadius: 8, minWidth: 220, boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{prettyMonth}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ color: '#2563EB' }}>🛒 Excel (Buy)</div>
          <div style={{ fontWeight: 700 }}>{fmt(d.excelPrice, selectedCommodity)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ color: '#059669' }}>📈 Market (Sell)</div>
          <div style={{ fontWeight: 700 }}>{fmt(d.marketPrice, selectedCommodity)}</div>
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>{axisUnit[selectedCommodity]}</div>
      </div>
    );
  };

  const yTickFormatter = v => {
    const decs = decimalsPerCommodity[selectedCommodity] ?? 2;
    return Number(v).toFixed(decs);
  };

  if (!chartData.length) return <div style={{ padding: 32, textAlign: 'center' }}>Loading chart…</div>;

  // debug table rows
  const tableRows = chartData.map(row => ({
    month: new Date(row.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    excel: row.excelPrice,
    rawApi: row.rawApi,
    converted: row.marketPrice,
    diff: row.diff,
    pctDiff: row.pctDiff
  }));

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto', background: 'white', borderRadius: 16, boxShadow: '0 10px 30px rgba(2,6,23,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>{selectedCommodity === 'wheat' ? '🌾 Wheat' : selectedCommodity === 'palm' ? '🌴 Palm Oil' : '🍬 Sugar'}</h2>
          <div style={{ color: '#6b7280', fontSize: 13 }}>{axisUnit[selectedCommodity]} — Blue = Buy, Green = Sell</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select value={selectedCommodity} onChange={e => setSelectedCommodity(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }}>
            <option value="wheat">Wheat</option>
            <option value="palm">Palm Oil</option>
            <option value="sugar">Sugar</option>
          </select>

          {selectedCommodity === 'wheat' && (
            <select value={selectedWheatType} onChange={e => setSelectedWheatType(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8 }}>
              <option value="zw">ZW (cents / bushel)</option>
              <option value="ml">ML (EUR / tonne)</option>
            </select>
          )}
        </div>
      </div>

      <div style={{ width: '100%', height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" angle={-45} height={70}
              tickFormatter={m => new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} />
            <YAxis tickFormatter={yTickFormatter} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="excelPrice" stroke="#3B82F6" strokeWidth={3} name="Buy (Excel)" dot={{ r: 3 }} />
            <Line type="monotone" dataKey="marketPrice" stroke="#10B981" strokeWidth={3} name="Sell (API)" dot={{ r: 3 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 16 }}>
        <div style={{ padding: 12, background: '#eff6ff', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ color: '#1e40af', fontWeight: 700, fontSize: 18 }}>{(precomputed[selectedCommodity] || []).length}</div>
          <div style={{ color: '#1e40af' }}>Excel Months</div>
        </div>
        <div style={{ padding: 12, background: '#ecfdf5', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ color: '#065f46', fontWeight: 700, fontSize: 18 }}>{(rawApiList || []).length}</div>
          <div style={{ color: '#065f46' }}>Market Points</div>
        </div>
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{chartData.length}</div>
          <div>Total Points</div>
        </div>
      </div>

      {/* debug table */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ margin: '10px 0', fontSize: 14 }}>Debug: Excel vs API conversions</h3>
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #eef2ff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Month</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Excel (buy)</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Raw API</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Converted (target)</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Diff (Excel - API)</th>
                <th style={{ textAlign: 'right', padding: 8 }}>Pct %</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>{r.month}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{r.excel == null ? '—' : Number(r.excel).toFixed(3)}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{r.rawApi == null ? '—' : r.rawApi}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{r.converted == null ? '—' : Number(r.converted).toFixed(3)}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{r.diff == null ? '—' : Number(r.diff).toFixed(3)}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{r.pctDiff == null ? '—' : `${r.pctDiff}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CommodityPriceChart;
