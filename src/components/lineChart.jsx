import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  COMPLETE_WHEAT_DATA, COMPLETE_PALM_OIL_DATA, COMPLETE_CRUDE_PALM_OIL_DATA,
  SUGAR_MONTH_COST, CAN_DATA
} from './wheat';

// ✅ ALUMINUM API DATA - Real historical prices (closing prices)
const ALUMINUM_API_DATA = [
  { month: '2024-07', api: 2374.75 },
  { month: '2024-08', api: 2522.5 },
  { month: '2024-09', api: 2676 },
  { month: '2024-10', api: 2687 },
  { month: '2024-11', api: 2672.75 },
  { month: '2024-12', api: 2602.5 },
  { month: '2025-01', api: 2613 },
  { month: '2025-02', api: 2613.25 },
  { month: '2025-03', api: 2526 },
  { month: '2025-04', api: 2380.75 },
  { month: '2025-05', api: 2414.25 },
  { month: '2025-06', api: 2595.5 },
  { month: '2025-07', api: 2521.5 },
  { month: '2025-08', api: 2543.75 },
  { month: '2025-09', api: 2622 },
  { month: '2025-10', api: 2843.75 },
  { month: '2025-11', api: 2808 },
  { month: '2025-12', api: 2816 }
];

// ✅ ALUMINUM FIXED PRICE DATA - $2400/tonne (supply chain negotiated price)
const ALUMINUM_FIXED_DATA = [
  { month: '2024-07', fixed: 2400 },
  { month: '2024-08', fixed: 2400 },
  { month: '2024-09', fixed: 2400 },
  { month: '2024-10', fixed: 2400 },
  { month: '2024-11', fixed: 2400 },
  { month: '2024-12', fixed: 2400 },
  { month: '2025-01', fixed: 2400 },
  { month: '2025-02', fixed: 2400 },
  { month: '2025-03', fixed: 2400 },
  { month: '2025-04', fixed: 2400 },
  { month: '2025-05', fixed: 2400 },
  { month: '2025-06', fixed: 2400 },
  { month: '2025-07', fixed: 2400 },
  { month: '2025-08', fixed: 2400 },
  { month: '2025-09', fixed: 2400 },
  { month: '2025-10', fixed: 2400 },
  { month: '2025-11', fixed: 2400 },
  { month: '2025-12', fixed: 2400 }
];

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
    { month: '2025-03', raw: 1290 }, { month: '2025-10', raw: 1220 }
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

// Average aluminum can weight (330ml can)
const ALUMINUM_CAN_WEIGHT_KG = 0.013; // 13g = 0.013kg

const BASIS_ADJUSTMENTS = {
  wheat: 1.30, 
  palm: 1.20, 
  'crude_palm': 1.15,
  sugar: 1.30,
  aluminum: 1.0
};

const decimalsByCommodity = {
  wheat: 3,
  palm: 2,
  'crude_palm': 3,
  sugar: 0,
  aluminum: 2
};

const unitsByCommodity = {
  wheat: 'USD/kg',
  palm: 'GHS/kg',
  'crude_palm': 'USD/kg',
  sugar: 'NGN/kg',
  aluminum: 'NGN/can'
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

function convertAluminumApiValue(apiPrice, conversionType = 'api') {
  // Convert USD/tonne to NGN/can
  const usdPerKg = apiPrice / TONNE_TO_KG;  // USD/kg
  const ngnPerKg = usdPerKg * FX.USD_to_NGN;  // NGN/kg
  const ngnPerCan = ngnPerKg * ALUMINUM_CAN_WEIGHT_KG;  // NGN/can
  return ngnPerCan;
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

  // For aluminum, we handle it separately in chartData
  return null;
}

function buildExcelMonthly(rawDataArray, commodity) {
  const bucket = new Map();

  rawDataArray.forEach(entry => {
    const monthKey = normalizeMonth(entry.poDate || entry.month);
    if (!monthKey) return;

    let price = Number(entry.rate ?? entry.cost ?? entry.avgPricePerUnit);
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

const CommodityPriceChart = () => {
  const [selectedCommodity, setSelectedCommodity] = useState('sugar');
  const [selectedWheatType, setSelectedWheatType] = useState('zw');
  const [precomputed, setPrecomputed] = useState({});

  useEffect(() => {
    const data = {
      wheat: buildExcelMonthly(COMPLETE_WHEAT_DATA, 'wheat'),
      palm: buildExcelMonthly(COMPLETE_PALM_OIL_DATA, 'palm'),
      'crude_palm': buildExcelMonthly(COMPLETE_CRUDE_PALM_OIL_DATA, 'crude_palm'),
      sugar: buildExcelMonthly(SUGAR_MONTH_COST.map(e => ({ month: e.month, cost: e.cost })), 'sugar'),
      aluminum: buildExcelMonthly(CAN_DATA, 'aluminum')
    };
    setPrecomputed(data);
  }, []);

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

  // Create maps for aluminum data
  const aluminumApiMap = useMemo(() => {
    const m = new Map();
    ALUMINUM_API_DATA.forEach(r => {
      const mm = normalizeMonth(r.month);
      if (mm) m.set(mm, r.api);
    });
    return m;
  }, []);

  const aluminumFixedMap = useMemo(() => {
    const m = new Map();
    ALUMINUM_FIXED_DATA.forEach(r => {
      const mm = normalizeMonth(r.month);
      if (mm) m.set(mm, r.fixed);
    });
    return m;
  }, []);

  const chartData = useMemo(() => {
    if (selectedCommodity === 'aluminum') {
      // For aluminum: Combine Excel data with API and Fixed prices
      const allMonths = new Set([
        ...excelData.map(d => d.month),
        ...Array.from(aluminumApiMap.keys()),
        ...Array.from(aluminumFixedMap.keys())
      ]);
      
      return Array.from(allMonths)
        .sort((a, b) => new Date(a + '-01') - new Date(b + '-01'))
        .map(month => {
          const excelEntry = excelData.find(d => d.month === month);
          const excelPrice = excelEntry?.excelPrice || null;
          const apiRaw = aluminumApiMap.get(month);
          const fixedRaw = aluminumFixedMap.get(month);
          
          // Convert API and Fixed prices to NGN/can
          const marketPriceApi = apiRaw != null ? convertAluminumApiValue(apiRaw, 'api') : null;
          const marketPriceFixed = fixedRaw != null ? convertAluminumApiValue(fixedRaw, 'fixed') : null;
          
          return {
            month,
            excelPrice,
            marketPriceApi,
            marketPriceFixed,
            rawApi: apiRaw,
            rawFixed: fixedRaw,
            // Compare Excel with API price (if available)
            diff: excelPrice != null && marketPriceApi != null ? excelPrice - marketPriceApi : null,
            diffFixed: excelPrice != null && marketPriceFixed != null ? excelPrice - marketPriceFixed : null,
            priceRatio: excelPrice != null && marketPriceApi != null ? (excelPrice / marketPriceApi).toFixed(2) : null,
            priceRatioFixed: excelPrice != null && marketPriceFixed != null ? (excelPrice / marketPriceFixed).toFixed(2) : null
          };
        });
    } else {
      // For other commodities: Use existing logic
      return excelData.map(d => {
        const raw = rawMap.get(d.month);
        const marketPrice = raw != null ? convertApiValue(selectedCommodity, selectedWheatType, raw) : null;
        const diff = marketPrice != null ? d.excelPrice - marketPrice : null;

        return {
          month: d.month,
          excelPrice: d.excelPrice,
          marketPrice,
          rawApi: raw,
          diff,
          priceRatio: marketPrice != null ? (d.excelPrice / marketPrice).toFixed(2) : null
        };
      });
    }
  }, [excelData, rawMap, selectedCommodity, selectedWheatType, aluminumApiMap, aluminumFixedMap]);

  // Calculate averages for aluminum comparison
  const aluminumStats = useMemo(() => {
    if (selectedCommodity !== 'aluminum') return null;
    
    const validApiData = chartData.filter(d => d.excelPrice != null && d.marketPriceApi != null);
    const validFixedData = chartData.filter(d => d.excelPrice != null && d.marketPriceFixed != null);
    
    if (validApiData.length === 0 && validFixedData.length === 0) return null;
    
    let avgExcel = 0, avgApi = 0, avgFixed = 0;
    
    if (validApiData.length > 0) {
      avgExcel = validApiData.reduce((sum, d) => sum + d.excelPrice, 0) / validApiData.length;
      avgApi = validApiData.reduce((sum, d) => sum + d.marketPriceApi, 0) / validApiData.length;
    }
    
    if (validFixedData.length > 0) {
      avgFixed = validFixedData.reduce((sum, d) => sum + d.marketPriceFixed, 0) / validFixedData.length;
    }
    
    const avgRatioApi = avgExcel / avgApi;
    const avgRatioFixed = avgExcel / avgFixed;
    
    return { avgExcel, avgApi, avgFixed, avgRatioApi, avgRatioFixed };
  }, [chartData, selectedCommodity]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const dec = decimalsByCommodity[selectedCommodity] ?? 3;
    const unit = unitsByCommodity[selectedCommodity];
    const fmt = v => v != null ? `${Number(v).toFixed(dec)} ${unit}` : '—';

    if (selectedCommodity === 'aluminum') {
      return (
        <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', minWidth: 300 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 12 }}>
            {new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#3B82F6' }}>📦 Processed Can Price</span>
            <span style={{ fontWeight: 'bold' }}>{fmt(d.excelPrice)}</span>
          </div>
          
          {d.marketPriceApi != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#10B981' }}>📈 Actual Market API</span>
              <span style={{ fontWeight: 'bold' }}>{fmt(d.marketPriceApi)}</span>
            </div>
          )}
          
          {d.marketPriceFixed != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#EF4444' }}>💰 Fixed $2400/tonne</span>
              <span style={{ fontWeight: 'bold' }}>{fmt(d.marketPriceFixed)}</span>
            </div>
          )}
          
          {(d.diff != null || d.diffFixed != null) && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              {d.diff != null && (
                <div style={{ marginBottom: 6 }}>
                  <span>📊 vs Actual API: </span>
                  <span style={{ color: d.diff > 0 ? '#ef4444' : '#10B981', fontWeight: 'bold' }}>
                    {Number(d.diff).toFixed(dec)} {unit}
                  </span>
                </div>
              )}
              {d.diffFixed != null && (
                <div>
                  <span>💰 vs Fixed Price: </span>
                  <span style={{ color: d.diffFixed > 0 ? '#ef4444' : '#10B981', fontWeight: 'bold' }}>
                    {Number(d.diffFixed).toFixed(dec)} {unit}
                  </span>
                </div>
              )}
              {d.priceRatio && (
                <div style={{ marginTop: 8, fontSize: '0.9em', color: '#6b7280' }}>
                  <div>Actual Market Multiple: {d.priceRatio}x</div>
                  {d.priceRatioFixed && (
                    <div>Fixed Price Multiple: {d.priceRatioFixed}x</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Original tooltip for other commodities
    return (
      <div style={{ background: 'white', padding: 16, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', minWidth: 260 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>
          {new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#3B82F6' }}>📊 Excel Price</span>
          <span style={{ fontWeight: 'bold' }}>{fmt(d.excelPrice)}</span>
        </div>
        {d.marketPrice != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#10B981' }}>📈 Market Price</span>
            <span style={{ fontWeight: 'bold' }}>{fmt(d.marketPrice)}</span>
          </div>
        )}
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
             selectedCommodity === 'sugar' ? '🍬 Sugar' :
             selectedCommodity === 'aluminum' ? '🥫 Aluminum Can Cost Analysis' : ''}
          </h2>
          <div style={{ color: '#6b7280', fontSize: 16 }}>
            {unitLabel} —{' '}
            {selectedCommodity === 'aluminum' ? (
              <>
                <span style={{ color: '#3B82F6' }}>Blue = Can Purchase Price</span>{' '}
                |{' '}
                <span style={{ color: '#10B981' }}>Green = Actual Market API</span>{' '}
                |{' '}
                <span style={{ color: '#EF4444' }}>Red = Fixed $2400/tonne</span>
              </>
            ) : (
              <>
                <span style={{ color: '#3B82F6' }}>Blue = Excel Price</span>{' '}
                |{' '}
                <span style={{ color: '#10B981' }}>Green = Market Price</span>
              </>
            )}
            {selectedCommodity === 'aluminum' && aluminumStats && aluminumStats.avgRatioApi && (
              <span style={{ marginLeft: 12, color: '#8b5cf6', fontWeight: 'bold' }}>
                Avg Multiple vs API: {aluminumStats.avgRatioApi.toFixed(2)}x
              </span>
            )}
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
            <option value="aluminum">🥫 Aluminum Cans (NGN/can)</option>
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
              name={selectedCommodity === 'aluminum' ? "Processed Can Price" : "Excel Price"}
              dot={{ fill: '#3B82F6', r: 6 }}
              activeDot={{ r: 8 }}
            />
            
            {selectedCommodity === 'aluminum' ? (
              <>
                <Line
                  type="monotone"
                  dataKey="marketPriceApi"
                  stroke="#10B981"
                  strokeWidth={3}
               
                  name="Actual Market API"
                  dot={{ fill: '#10B981', r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  type="monotone"
                  dataKey="marketPriceFixed"
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  name="Fixed $2400/tonne"
                  dot={{ fill: '#EF4444', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="marketPrice"
                stroke="#10B981"
                strokeWidth={4}
                name="Market Price"
                dot={{ fill: '#10B981', r: 6 }}
                activeDot={{ r: 8 }}
              />
            )}
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
            {selectedCommodity === 'aluminum' 
              ? chartData.filter(d => d.marketPriceApi != null).length
              : chartData.filter(d => d.marketPrice != null).length}
          </div>
          <div>{selectedCommodity === 'aluminum' ? 'API Matches' : 'Market Matches'}</div>
        </div>
        <div style={{ padding: 16, background: '#f3f4f6', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 24 }}>{chartData.length}</div>
          <div>Chart Points</div>
        </div>
        <div style={{ padding: 16, background: '#fef3c7', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ color: '#d97706', fontWeight: 700, fontSize: 24 }}>
            {selectedCommodity === 'aluminum' 
              ? chartData.filter(d => d.diff != null && d.diff > 0).length
              : chartData.filter(d => d.diff != null && d.diff > 0).length}
          </div>
          <div>Positive Spread</div>
        </div>
      </div>

      {/* ✅ Aluminum-specific insights */}
      {selectedCommodity === 'aluminum' && aluminumStats && (
        <div style={{ marginTop: 24, padding: 16, background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd' }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#0369a1' }}>📊 Aluminum Can Cost Breakdown (per can)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: '0.9em' }}>Avg Processed Can Price</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{aluminumStats.avgExcel.toFixed(2)} NGN/can</div>
            </div>
            {aluminumStats.avgApi > 0 && (
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.9em' }}>Avg Actual API Raw Cost</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{aluminumStats.avgApi.toFixed(2)} NGN/can</div>
              </div>
            )}
            <div>
              <div style={{ color: '#6b7280', fontSize: '0.9em' }}>Fixed Price Raw Cost</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>{aluminumStats.avgFixed.toFixed(2)} NGN/can</div>
            </div>
          </div>
          
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {aluminumStats.avgApi > 0 && (
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.9em' }}>Manufacturing Premium (vs Actual API)</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2em', color: '#ef4444' }}>
                  {(aluminumStats.avgExcel - aluminumStats.avgApi).toFixed(2)} NGN/can
                  <span style={{ marginLeft: 8, fontSize: '0.9em', color: '#6b7280' }}>
                    ({aluminumStats.avgRatioApi.toFixed(2)}x multiple)
                  </span>
                </div>
              </div>
            )}
            <div>
              <div style={{ color: '#6b7280', fontSize: '0.9em' }}>Manufacturing Premium (vs Fixed Price)</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.2em', color: '#dc2626' }}>
                {(aluminumStats.avgExcel - aluminumStats.avgFixed).toFixed(2)} NGN/can
                <span style={{ marginLeft: 8, fontSize: '0.9em', color: '#6b7280' }}>
                  ({aluminumStats.avgRatioFixed.toFixed(2)}x multiple)
                </span>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: 12, fontSize: '0.9em', color: '#6b7280' }}>
            <strong>Analysis:</strong> Processed aluminum cans cost{' '}
            <strong>{aluminumStats.avgRatioApi.toFixed(2)}x</strong> more than actual market API prices and{' '}
            <strong>{aluminumStats.avgRatioFixed.toFixed(2)}x</strong> more than the fixed $2400/tonne price.
            This premium covers manufacturing, transportation, packaging, and supplier profit.
          </div>
          <div style={{ marginTop: 8, fontSize: '0.85em', color: '#9ca3af' }}>
            <em>Note: Raw aluminum conversion: USD/tonne × 1650 NGN/USD ÷ 1000 kg/tonne × 0.013 kg/can = NGN/can</em>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommodityPriceChart;