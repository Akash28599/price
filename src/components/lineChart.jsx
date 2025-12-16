import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  COMPLETE_WHEAT_DATA, COMPLETE_PALM_OIL_DATA, COMPLETE_CRUDE_PALM_OIL_DATA,
  SUGAR_MONTH_COST
} from './wheat';

// FX + constants
const FX = {
  GHS_to_USD: 0.087,
  USD_to_GHS: 11.44,
  USD_to_NGN: 1650,
  MYR_to_USD: 0.2430
};
const MYR_to_GHS = FX.MYR_to_USD * FX.USD_to_GHS;

const BUSHEL_TO_KG_WHEAT = 27.2155;
const TONNE_TO_KG = 1000;
const LB_TO_KG = 0.45359237;

// ✅ FIXED - Consistent 'crude_palm' keys
const RAW_FALLBACK_DATA = {
  'wheat-zw': [
    { month: '2025-01', raw: 600.2 }, { month: '2025-02', raw: 640.3 },
    { month: '2025-03', raw: 609.1 }, { month: '2025-04', raw: 587.2 },
    { month: '2025-05', raw: 569.2 }, { month: '2025-06', raw: 578.4 },
    { month: '2025-07', raw: 564.4 }, { month: '2025-08', raw: 529.6 },
    { month: '2025-09', raw: 522.2 }, { month: '2025-10', raw: 512.0 },
    { month: '2025-11', raw: 534.8 }
  ],
  palm: [
    { month: '2025-01', raw: 4094 }, { month: '2025-02', raw: 4250 },
    { month: '2025-03', raw: 4177 }, { month: '2025-04', raw: 4010 },
    { month: '2025-05', raw: 3875 }, { month: '2025-06', raw: 3998 },
    { month: '2025-07', raw: 4140 }, { month: '2025-08', raw: 4455 },
    { month: '2025-09', raw: 4440 }, { month: '2025-10', raw: 4440 },
    { month: '2025-11', raw: 4085 }
  ],
  'crude_palm': [  
    { month: '2024-10', raw: 1100 }, { month: '2024-12', raw: 1310 },
    { month: '2025-01', raw: 1295 }, { month: '2025-02', raw: 1260 },
    { month: '2025-03', raw: 1290 },{month: '2025-10', raw: 1220}
  ],
  sugar: [
    { month: '2024-10', raw: 19.82 }, { month: '2024-11', raw: 19.06 },
    { month: '2024-12', raw: 17.70 }, { month: '2025-01', raw: 18.02 },
    { month: '2025-02', raw: 18.59 }, { month: '2025-03', raw: 19.20 },
    { month: '2025-04', raw: 17.82 }, { month: '2025-05', raw: 17.69 },
    { month: '2025-06', raw: 16.94 }, { month: '2025-07', raw: 16.97 },
    { month: '2025-08', raw: 17.01 }, { month: '2025-09', raw: 16.60 },
    { month: '2025-10', raw: 16.20 }, { month: '2025-11', raw: 16.80 },
    { month: '2025-12', raw: 16.50 }
  ]
};

const BASIS_ADJUSTMENTS = {
  wheat: 1.30, 
  palm: 1.20, 
  'crude_palm': 1.15,
  sugar: 1.30  
};

function normalizeMonth(value) {
  if (!value) return null;
  value = String(value).trim();

  const shortMonth = value.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (shortMonth) {
    const mon = shortMonth[1];
    let yr = shortMonth[2];
    if (yr.length === 2) yr = `20${yr}`;
    const monthNames = {
      Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
      Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12'
    };
    if (monthNames[mon]) return `${yr}-${monthNames[mon]}`;
  }

  const ymd = value.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}`;

  const mdRegex = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mdRegex) {
    const [, month, , year] = mdRegex;
    return `${year}-${String(month).padStart(2,'0')}`;
  }

  const d = new Date(value);
  if (!isNaN(d)) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
  }
  return null;
}

function convertApiValue(commodity, wheatType, rawValue) {
  if (rawValue == null || isNaN(Number(rawValue))) return null;
  const rv = Number(rawValue);

  if (commodity === 'wheat' && wheatType === 'zw') {
    const usdPerBushel = rv / 100;
    const usdPerKgRaw = usdPerBushel / BUSHEL_TO_KG_WHEAT;
    return usdPerKgRaw * BASIS_ADJUSTMENTS.wheat;
  }

  if (commodity === 'palm') {
    const myrPerKg = rv / TONNE_TO_KG;
    const ghsPerKg = myrPerKg * MYR_to_GHS;
    return ghsPerKg * BASIS_ADJUSTMENTS.palm;
  }

  if (commodity === 'crude_palm') {
    const usdPerKg = rv / TONNE_TO_KG;
    return usdPerKg * BASIS_ADJUSTMENTS['crude_palm'];
  }

  if (commodity === 'sugar') {
    const usdPerLb = rv / 100;
    const usdPerKg = usdPerLb / LB_TO_KG;
    const ngnPerKg = usdPerKg * FX.USD_to_NGN;
    return ngnPerKg * BASIS_ADJUSTMENTS.sugar;
  }

  return null;
}

function buildExcelMonthly(rawDataArray, commodity) {
  const bucket = new Map();

  rawDataArray.forEach(entry => {
    const monthKey = normalizeMonth(entry.poDate || entry.month);
    if (!monthKey) return;

    let price = Number(entry.rate ?? entry.cost);
    if (isNaN(price)) return;

    if (commodity === 'wheat' && entry.currency === 'GHS') {
      price *= FX.GHS_to_USD;
    }

    if (!bucket.has(monthKey)) bucket.set(monthKey, []);
    bucket.get(monthKey).push(price);
  });

  return Array.from(bucket.entries())
    .map(([month, prices]) => ({
      month,
      excelPrice: parseFloat((prices.reduce((a,b)=>a+b,0) / prices.length).toFixed(3))
    }))
    .sort((a,b) => new Date(a.month + '-01') - new Date(b.month + '-01'));
}

const decimalsByCommodity = {
  wheat: 3,
  palm: 2,
  'crude_palm': 3,
  sugar: 0
};

const unitsByCommodity = {
  wheat: 'USD/kg',
  palm: 'GHS/kg',
  'crude_palm': 'USD/kg',
  sugar: 'NGN/kg'
};

const CommodityPriceChart = () => {
  const [selectedCommodity, setSelectedCommodity] = useState('sugar');
  const [selectedWheatType, setSelectedWheatType] = useState('zw');
  const [precomputed, setPrecomputed] = useState({});

  // ✅ FIXED - Memoized precompute
  useEffect(() => {
    const data = {
      wheat: buildExcelMonthly(COMPLETE_WHEAT_DATA, 'wheat'),
      palm: buildExcelMonthly(COMPLETE_PALM_OIL_DATA, 'palm'),
      'crude_palm': buildExcelMonthly(COMPLETE_CRUDE_PALM_OIL_DATA, 'crude_palm'),
      sugar: buildExcelMonthly(SUGAR_MONTH_COST.map(e => ({ month: e.month, cost: e.cost })), 'sugar')
    };
    setPrecomputed(data);
  }, []);

  // ✅ FIXED - Memoized excelData & rawApiList
  const excelData = useMemo(() => precomputed[selectedCommodity] || [], [precomputed, selectedCommodity]);
  
  const apiKey = selectedCommodity === 'wheat' ? `wheat-${selectedWheatType}` : selectedCommodity;
  const rawApiList = useMemo(() => RAW_FALLBACK_DATA[apiKey] || [], [apiKey]);

  const rawMap = useMemo(() => {
    const m = new Map();
    rawApiList.forEach(r => {
      const mm = normalizeMonth(r.month);
      if (mm) m.set(mm, r.raw);
    });
    return m;
  }, [rawApiList]);

  const chartData = useMemo(() => {
    return excelData.map(d => {
      const raw = rawMap.get(d.month);
      const marketPrice = raw != null ? convertApiValue(selectedCommodity, selectedWheatType, raw) : null;
      const diff = marketPrice != null ? d.excelPrice - marketPrice : null;

      return {
        month: d.month,
        excelPrice: d.excelPrice,
        marketPrice,
        rawApi: raw,
        diff
      };
    });
  }, [excelData, rawMap, selectedCommodity, selectedWheatType]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const dec = decimalsByCommodity[selectedCommodity] ?? 3;
    const unit = unitsByCommodity[selectedCommodity];
    const fmt = v => v != null ? `${Number(v).toFixed(dec)} ${unit}` : '—';

    return (
      <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', minWidth: 260 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>
          {new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#3B82F6' }}>📊 Excel Buy</span>
          <span style={{ fontWeight: 'bold' }}>{fmt(d.excelPrice)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#10B981' }}>📈 Market Price</span>
          <span style={{ fontWeight: 'bold' }}>{fmt(d.marketPrice)}</span>
        </div>
        {d.diff != null && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
            <span>💰 Spread: </span>
            <span style={{ color: d.diff > 0 ? '#ef4444' : '#10B981', fontWeight: 'bold' }}>
              {Number(d.diff).toFixed(dec)} {unit}
            </span>
          </div>
        )}
      </div>
    );
  };

  // ✅ FIXED - Use chartData.length instead of excelData
  if (!chartData.length) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  }

  const unitLabel = unitsByCommodity[selectedCommodity];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', background: 'white', borderRadius: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
            {selectedCommodity === 'wheat' ? '🌾 Wheat Flour' :
             selectedCommodity === 'palm' ? '🌴 Palm Oil' :
             selectedCommodity === 'crude_palm' ? '🛢️ Crude Palm Oil' :
             '🍬 Sugar'}
          </h2>
          <div style={{ color: '#6b7280', fontSize: 16 }}>
            {unitLabel} —{' '}
            <span style={{ color: '#3B82F6' }}>Blue = Excel (buy)</span>{' '}
            |{' '}
            <span style={{ color: '#10B981' }}>Green = Market (+basis)</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <select
            value={selectedCommodity}
            onChange={e => setSelectedCommodity(e.target.value)}
            style={{ padding: '12px 20px', borderRadius: 12, border: '2px solid #e5e7eb', fontSize: 16 }}
          >
            <option value="wheat">🌾 Wheat (USD/kg)</option>
            <option value="palm">🌴 Palm Oil (GHS/kg)</option>
            <option value="crude_palm">🛢️ Crude Palm Oil (USD/kg)</option>
            <option value="sugar">🍬 Sugar (NGN/kg)</option>
          </select>
          {selectedCommodity === 'wheat' && (
            <select
              value={selectedWheatType}
              onChange={e => setSelectedWheatType(e.target.value)}
              style={{ padding: '12px 20px', borderRadius: 12, border: '2px solid #e5e7eb', fontSize: 16 }}
            >
              <option value="zw">ZW Wheat (cents/bushel)</option>
            </select>
          )}
        </div>
      </div>

      <div style={{ width: '100%', height: 500 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis 
              dataKey="month" 
              interval={0} 
              angle={-45} 
              height={90}
              tickFormatter={m => new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} 
            />
            <YAxis 
              tickFormatter={v => Number(v).toFixed(decimalsByCommodity[selectedCommodity] ?? 3)} 
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="excelPrice"
              stroke="#3B82F6"
              strokeWidth={4}
              name="Excel"
              dot={{ fill: '#3B82F6', r: 6 }}
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey="marketPrice"
              stroke="#10B981"
              strokeWidth={4}
              name="Market"
              dot={{ fill: '#10B981', r: 6 }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: 24 }}>
        <div style={{ padding: 16, background: '#eff6ff', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ color: '#1e40af', fontWeight: 700, fontSize: 24 }}>{excelData.length}</div>
          <div>Excel Months</div>
        </div>
        <div style={{ padding: 16, background: '#ecfdf5', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ color: '#059669', fontWeight: 700, fontSize: 24 }}>
            {chartData.filter(d => d.marketPrice != null).length}
          </div>
          <div>Market Matches</div>
        </div>
        <div style={{ padding: 16, background: '#f3f4f6', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 24 }}>{chartData.length}</div>
          <div>Chart Points</div>
        </div>
        <div style={{ padding: 16, background: '#fef3c7', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ color: '#d97706', fontWeight: 700, fontSize: 24 }}>
            {chartData.filter(d => d.diff != null && d.diff > 0).length}
          </div>
          <div>Positive Spread</div>
        </div>
      </div>
    </div>
  );
};

export default CommodityPriceChart;
