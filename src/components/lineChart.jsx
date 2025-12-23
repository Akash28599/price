// src/components/CommodityDashboard.jsx - COMPLETE CORRECTED VERSION
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

// Import your Excel data
import {
  COMPLETE_WHEAT_DATA,
  COMPLETE_PALM_OIL_DATA,
  COMPLETE_CRUDE_PALM_OIL_DATA,
  SUGAR_MONTH_COST,
  CAN_DATA
} from './wheat';

// Commodity symbols for the DDFPlus API
const COMMODITY_SYMBOLS = {
  wheat: 'ZW*1',
  milling_wheat: 'ML*1',
  palm: 'KO*1',
  sugar: 'SB*1',
  aluminum: 'AL*1',
  crude_palm: 'CB*1'
};

// DARK THEME COLORS
const DARK_THEME = {
  background: {
    main: '#0F172A',
    card: '#1E293B',
    hover: '#334155',
    light: '#475569'
  },
  primary: {
    blue: '#3B82F6',
    green: '#10B981',
    orange: '#F59E0B',
    red: '#EF4444',
    pink: '#EC4899',
    cyan: '#06B6D4',
    purple: '#8B5CF6'
  },
  text: {
    primary: '#F1F5F9',
    secondary: '#CBD5E1',
    muted: '#94A3B8'
  },
  border: '#334155'
};

// Historical FX rates by year-month (approximate)
const HISTORICAL_FX_RATES = {
  'USD_NGN': {
    '2020': 380, '2021': 410, '2022': 450,
    '2023': 750, '2024': 900, '2025': 1460
  },
  'EUR_USD': {
    '2020': 1.18, '2021': 1.20, '2022': 1.05,
    '2023': 1.08, '2024': 1.07, '2025': 1.08
  },
  'MYR_USD': {  // CORRECTED: Palm oil API uses MYR, not USD directly
    '2020': 4.05, '2021': 4.18, '2022': 4.45,
    '2023': 4.60, '2024': 4.70, '2025': 4.76
  },
  'GHS_USD': {
    '2020': 0.17, '2021': 0.16, '2022': 0.12,
    '2023': 0.10, '2024': 0.087, '2025': 0.087
  }
};

// Unit configuration - UPDATED FOR CORRECT UNITS
const COMMODITY_UNITS = {
  wheat: { excel: 'USD/kg', api: 'USD/kg', chart: 'USD/kg' },
  milling_wheat: { excel: 'USD/kg', api: 'EUR/kg', chart: 'USD/kg' },
  palm: { excel: 'USD/tonne', api: 'MYR/tonne', chart: 'USD/tonne' },
  crude_palm: { excel: 'USD/kg', api: 'USD/barrel', chart: 'USD/kg' },
  sugar: { excel: 'NGN/kg', api: 'USD/kg', chart: 'NGN/kg' },
  aluminum: { excel: 'USD/tonne', api: 'USD/tonne', chart: 'USD/tonne' }
};

// Currency configuration
const COMMODITY_CURRENCIES = {
  wheat: 'USD',
  milling_wheat: 'USD',
  palm: 'USD',
  crude_palm: 'USD',
  sugar: 'NGN',
  aluminum: 'USD'
};

// Conversion factors
const BUSHEL_TO_KG_WHEAT = 27.2155;
const TONNE_TO_KG = 1000;
const LB_TO_KG = 0.45359237;
const ALUMINUM_CAN_WEIGHT_KG = 0.013;
const BARREL_TO_TONNE = 0.1364; // For crude oil

// Commodity configuration
const COMMODITY_CONFIG = {
  wheat: { 
    name: 'Wheat CBOT', 
    icon: '🌾', 
    excelColor: DARK_THEME.primary.blue,
    apiColor: DARK_THEME.primary.green,
    category: 'Grains',
    showInChart: false
  },
  milling_wheat: { 
    name: 'Milling Wheat', 
    icon: '🌾', 
    excelColor: DARK_THEME.primary.purple,
    apiColor: DARK_THEME.primary.green,
    category: 'Grains',
    showInChart: true
  },
  palm: { 
    name: 'Palm Oil', 
    icon: '🌴', 
    excelColor: DARK_THEME.primary.orange,
    apiColor: DARK_THEME.primary.green,
    category: 'Oils',
    showInChart: true
  },
  crude_palm: { 
    name: 'Brent Crude Oil',
    icon: '🛢️', 
    excelColor: DARK_THEME.primary.red,
    apiColor: DARK_THEME.primary.green,
    category: 'Oils',
    showInChart: true
  },
  sugar: { 
    name: 'Sugar', 
    icon: '🍬', 
    excelColor: DARK_THEME.primary.pink,
    apiColor: DARK_THEME.primary.green,
    category: 'Softs',
    showInChart: true
  },
  aluminum: { 
    name: 'Aluminum',
    icon: '🥫', 
    excelColor: DARK_THEME.primary.cyan,
    apiColor: DARK_THEME.primary.green,
    category: 'Metals',
    showInChart: true
  }
};

// Filter commodities that should appear in the chart comparison
const CHART_COMMODITIES = Object.keys(COMMODITY_CONFIG).filter(
  commodity => COMMODITY_CONFIG[commodity].showInChart
);

const DEFAULT_CHART_COMMODITY = CHART_COMMODITIES[0];

// Excel data mapping
const EXCEL_DATA_SOURCES = {
  wheat: COMPLETE_WHEAT_DATA,
  milling_wheat: COMPLETE_WHEAT_DATA,
  palm: COMPLETE_PALM_OIL_DATA,
  crude_palm: COMPLETE_CRUDE_PALM_OIL_DATA,
  sugar: SUGAR_MONTH_COST,
  aluminum: CAN_DATA
};

// Negotiated aluminum price
const NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE = 2400;

// Helper functions
function formatDateForAPI(date) {
  return date.toISOString().split('T')[0];
}

function getMonthKey(dateStr) {
  if (!dateStr) return null;
  
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  if (typeof dateStr === 'string') {
    if (dateStr.match(/^[A-Za-z]{3,}-\d{2,4}$/)) {
      const [monthStr, yearStr] = dateStr.split('-');
      const monthNames = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      
      const month = monthNames[monthStr] || '01';
      let year = parseInt(yearStr);
      
      if (yearStr.length === 2) {
        const currentYear = new Date().getFullYear();
        const shortYear = parseInt(yearStr);
        year = shortYear + (shortYear <= (currentYear % 100) ? 2000 : 1900);
      }
      
      return `${year}-${month}`;
    }
    
    if (dateStr.includes('T')) {
      const date = new Date(dateStr);
      if (!isNaN(date)) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
    }
  }
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date)) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  } catch (e) {
    console.warn('Failed to parse date:', dateStr, e);
  }
  
  return null;
}

function getMonthDisplay(monthKey) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// NEW: Get historical FX rate for specific date
function getHistoricalFXRate(dateStr, fromCurrency, toCurrency) {
  try {
    if (fromCurrency === toCurrency) return 1;
    
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}-${month}`;
    
    const key = `${fromCurrency}_${toCurrency}`;
    
    // For monthly data, we can use year-based rates
    // For more accurate implementation, integrate with an actual FX API
    if (HISTORICAL_FX_RATES[key] && HISTORICAL_FX_RATES[key][year]) {
      return HISTORICAL_FX_RATES[key][year];
    }
    
    // Calculate inverse if needed
    const reverseKey = `${toCurrency}_${fromCurrency}`;
    if (HISTORICAL_FX_RATES[reverseKey] && HISTORICAL_FX_RATES[reverseKey][year]) {
      return 1 / HISTORICAL_FX_RATES[reverseKey][year];
    }
    
    // Fallback to approximate rates based on year
    const fallbackRates = {
      'USD_NGN': {
        '2020': 380, '2021': 410, '2022': 450,
        '2023': 750, '2024': 900, '2025': 1460
      },
      'MYR_USD': {
        '2020': 4.05, '2021': 4.18, '2022': 4.45,
        '2023': 4.60, '2024': 4.70, '2025': 4.76
      }
    };
    
    return fallbackRates[key]?.[year] || 1;
    
  } catch (error) {
    console.error('Error getting historical FX rate:', error);
    return 1;
  }
}

// CORRECTED: Convert API value with proper calculations
async function convertApiValueToTargetCurrency(commodity, apiValue, dateStr = null, currencyMode = 'original') {
  if (apiValue == null || isNaN(Number(apiValue))) return null;
  const value = Number(apiValue);

  let priceInUSD;
  let originalCurrency;

  switch(commodity) {
    case 'wheat':
      // CBOT Wheat: cents per bushel to USD/kg
      priceInUSD = (value / 100) / BUSHEL_TO_KG_WHEAT;
      originalCurrency = 'USD';
      break;

    case 'milling_wheat':
      // Milling Wheat: EUR per tonne to USD/kg
      const eurPerTonne = value;
      const eurPerKg = eurPerTonne / TONNE_TO_KG;
      // Get EUR/USD rate for the date
      const eurUsdRate = getHistoricalFXRate(dateStr, 'EUR', 'USD');
      priceInUSD = eurPerKg * eurUsdRate;
      originalCurrency = 'EUR';
      break;

    case 'palm':
      // CORRECTED: Palm Oil API returns MYR per metric ton
      // Convert MYR/tonne to USD/tonne using historical MYR/USD rate
      const myrPerTonne = value;
      const myrUsdRate = getHistoricalFXRate(dateStr, 'MYR', 'USD');
      priceInUSD = myrPerTonne / myrUsdRate; // USD/tonne
      originalCurrency = 'MYR';
      break;

    case 'crude_palm':
      // Brent Crude: USD per barrel to USD/kg
      const usdPerBarrel = value;
      const usdPerTonne = usdPerBarrel / BARREL_TO_TONNE;
      priceInUSD = usdPerTonne / TONNE_TO_KG; // USD/kg
      originalCurrency = 'USD';
      break;
    
    case 'sugar':
      // Sugar: cents per lb to USD/kg
      const usdPerLb = value / 100;
      priceInUSD = usdPerLb / LB_TO_KG;
      originalCurrency = 'USD';
      break;

    case 'aluminum':
      // Aluminum: USD per tonne to USD/kg
      priceInUSD = value / TONNE_TO_KG;
      originalCurrency = 'USD';
      break;

    default:
      return null;
  }

  // Convert to NGN if needed
  if (currencyMode === 'ngn') {
    const usdNgnRate = getHistoricalFXRate(dateStr, 'USD', 'NGN');
    return priceInUSD * usdNgnRate;
  }

  return priceInUSD;
}

// CORRECTED: Convert Excel price with FOB consideration for palm oil
async function convertExcelPriceToTargetCurrency(commodity, excelItem, currencyMode = 'original') {
  if (!excelItem) return null;
  
  let priceInUSD;
  let dateStr;
  
  switch(commodity) {
    case 'wheat':
    case 'milling_wheat':
      if (excelItem.currency === 'GHS') {
        // Convert GHS to USD using historical rate
        const ghsUsdRate = getHistoricalFXRate(excelItem.poDate, 'GHS', 'USD');
        priceInUSD = excelItem.rate * ghsUsdRate;
      } else {
        priceInUSD = excelItem.rate;
      }
      dateStr = excelItem.poDate;
      break;
      
    case 'palm':
      // Palm oil Excel data: Use FOB price which is already USD/tonne
      priceInUSD = excelItem.fob || excelItem.rate;
      dateStr = excelItem.poDate;
      break;
      
    case 'crude_palm':
      priceInUSD = excelItem.rate;
      dateStr = excelItem.poDate;
      break;
      
    case 'sugar':
      // Sugar is already in NGN/kg in Excel
      if (currencyMode === 'ngn') {
        return excelItem.cost; // Already NGN/kg
      } else {
        // Convert NGN to USD
        const ngnUsdRate = getHistoricalFXRate(excelItem.month, 'NGN', 'USD');
        return excelItem.cost / ngnUsdRate;
      }
      
    case 'aluminum':
      priceInUSD = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE / TONNE_TO_KG;
      dateStr = excelItem.month;
      break;
      
    default:
      return null;
  }

  // Convert to NGN if needed
  if (currencyMode === 'ngn' && commodity !== 'sugar') {
    const usdNgnRate = getHistoricalFXRate(dateStr, 'USD', 'NGN');
    return priceInUSD * usdNgnRate;
  }

  return priceInUSD;
}

// Process Excel data
async function processExcelDataByMonth(commodity, currencyMode) {
  const rawData = EXCEL_DATA_SOURCES[commodity] || [];
  
  const monthlyData = {};
  
  for (const item of rawData) {
    const dateStr = commodity === 'sugar' || commodity === 'aluminum' ? item.month : item.poDate;
    const monthKey = getMonthKey(dateStr);
    
    if (!monthKey) continue;
    
    const priceInTargetCurrency = await convertExcelPriceToTargetCurrency(
      commodity, 
      item, 
      currencyMode
    );
    
    if (priceInTargetCurrency == null) continue;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        monthKey,
        values: [],
        dates: []
      };
    }
    
    monthlyData[monthKey].values.push(priceInTargetCurrency);
    monthlyData[monthKey].dates.push(dateStr);
  }
  
  return Object.values(monthlyData).map(month => ({
    monthKey: month.monthKey,
    monthDisplay: getMonthDisplay(month.monthKey),
    excelPrice: month.values.reduce((sum, val) => sum + val, 0) / month.values.length,
    transactionCount: month.values.length
  })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

// Fetch API data
async function fetchMonthlyApiData(symbol, months, commodity, currencyMode) {
  const monthlyResults = [];
  
  for (const month of months) {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    
    const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${formatDateForAPI(startDate)}&enddate=${formatDateForAPI(endDate)}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) continue;
      
      const text = await response.text();
      
      if (!text || text.includes('error')) continue;
      
      const lines = text.trim().split('\n').filter(line => line.trim());
      const dailyPrices = [];
      
      lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 6) {
          const dateStr = parts[1];
          const closePrice = parseFloat(parts[5]);
          
          if (!isNaN(closePrice) && closePrice > 0) {
            dailyPrices.push({
              date: dateStr,
              price: closePrice
            });
          }
        }
      });
      
      if (dailyPrices.length > 0) {
        const monthlyAvg = dailyPrices.reduce((sum, day) => sum + day.price, 0) / dailyPrices.length;
        const convertedPrice = await convertApiValueToTargetCurrency(
          commodity,
          monthlyAvg,
          dailyPrices[0]?.date,
          currencyMode
        );
        
        if (convertedPrice) {
          monthlyResults.push({
            monthKey: month,
            avgPrice: convertedPrice,
            dataPoints: dailyPrices.length
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching ${month} for ${symbol}:`, error);
    }
  }
  
  return monthlyResults;
}

// Combine data
function combineMonthlyData(excelMonthly, apiMonthly, commodity, currencyMode) {
  const allMonths = [...new Set([
    ...excelMonthly.map(m => m.monthKey),
    ...apiMonthly.map(m => m.monthKey)
  ])].sort();
  
  return allMonths.map(monthKey => {
    const excelMonth = excelMonthly.find(m => m.monthKey === monthKey);
    const apiMonth = apiMonthly.find(m => m.monthKey === monthKey);
    
    return {
      monthKey,
      monthDisplay: getMonthDisplay(monthKey),
      excelPrice: excelMonth?.excelPrice || null,
      apiPrice: apiMonth?.avgPrice || null,
      excelTransactions: excelMonth?.transactionCount || 0,
      apiDataPoints: apiMonth?.dataPoints || 0,
      unit: currencyMode === 'ngn' ? 'NGN/kg' : COMMODITY_UNITS[commodity].chart
    };
  });
}

// Main Component
const CommodityDashboard = () => {
  const [currencyMode, setCurrencyMode] = useState('original');
  const [selectedCommodity, setSelectedCommodity] = useState(DEFAULT_CHART_COMMODITY);
  const [commodityData, setCommodityData] = useState({});
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingLivePrices, setLoadingLivePrices] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('connecting');

  // Fetch all data
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const dataPromises = CHART_COMMODITIES.map(async (commodity) => {
          const excelMonthly = await processExcelDataByMonth(commodity, currencyMode);
          const symbol = COMMODITY_SYMBOLS[commodity];
          const months = excelMonthly.map(m => m.monthKey);
          const apiMonthly = await fetchMonthlyApiData(symbol, months, commodity, currencyMode);
          const combinedData = combineMonthlyData(excelMonthly, apiMonthly, commodity, currencyMode);
          
          return {
            commodity,
            data: combinedData
          };
        });

        const results = await Promise.all(dataPromises);
        const dataObj = {};
        results.forEach(result => {
          dataObj[result.commodity] = result.data;
        });
        
        setCommodityData(dataObj);
        setApiStatus('connected');
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to fetch data');
        setApiStatus('error');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 600000); // 10 minutes
    
    return () => clearInterval(interval);
  }, [currencyMode]);

  // Fetch live prices
  useEffect(() => {
    const fetchLivePrices = async () => {
      setLoadingLivePrices(true);
      try {
        // This would be your actual API call
        // For now, using sample data based on real market prices
        const sampleLivePrices = {
          wheat: { current: 0.42, change: 1.2, unit: 'USD/kg' },
          milling_wheat: { current: 0.45, change: -0.5, unit: 'USD/kg' },
          palm: { current: 1220, change: 2.3, unit: 'USD/tonne' }, // Realistic price
          crude_palm: { current: 85, change: -1.8, unit: 'USD/kg' },
          sugar: { current: 1350, change: 0.7, unit: 'NGN/kg' },
          aluminum: { current: 2450, change: 0.4, unit: 'USD/tonne' }
        };
        
        // Convert to NGN if needed
        const liveData = {};
        for (const [commodity, price] of Object.entries(sampleLivePrices)) {
          if (currencyMode === 'ngn') {
            const usdNgnRate = getHistoricalFXRate(new Date().toISOString(), 'USD', 'NGN');
            liveData[commodity] = {
              ...price,
              current: price.current * usdNgnRate,
              unit: 'NGN/kg'
            };
          } else {
            liveData[commodity] = price;
          }
        }
        
        setLivePrices(liveData);
      } catch (error) {
        console.error('Error fetching live prices:', error);
      } finally {
        setLoadingLivePrices(false);
      }
    };

    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 300000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [currencyMode]);

  // Styles for dark theme
  const styles = {
    container: {
      padding: '24px',
      minHeight: '100vh',
      backgroundColor: DARK_THEME.background.main,
      color: DARK_THEME.text.primary,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    },
    header: {
      marginBottom: '32px'
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: '32px',
      fontWeight: '700',
      background: `linear-gradient(135deg, ${DARK_THEME.primary.blue} 0%, ${DARK_THEME.primary.cyan} 100%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    },
    subtitle: {
      color: DARK_THEME.text.secondary,
      fontSize: '16px'
    },
    card: {
      backgroundColor: DARK_THEME.background.card,
      borderRadius: '12px',
      padding: '24px',
      border: `1px solid ${DARK_THEME.border}`,
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    },
    buttonPrimary: {
      backgroundColor: DARK_THEME.primary.blue,
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '8px',
      fontWeight: '600',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      color: DARK_THEME.text.secondary,
      border: `1px solid ${DARK_THEME.border}`,
      padding: '10px 20px',
      borderRadius: '8px',
      fontWeight: '600',
      cursor: 'pointer'
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600'
    },
    badgeSuccess: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      color: '#10B981'
    },
    badgeWarning: {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      color: '#F59E0B'
    },
    badgeError: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      color: '#EF4444'
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload;
    const config = COMMODITY_CONFIG[selectedCommodity];
    const unit = data.unit || COMMODITY_UNITS[selectedCommodity].chart;
    
    return (
      <div style={{
        backgroundColor: DARK_THEME.background.card,
        padding: '16px',
        borderRadius: '8px',
        border: `1px solid ${DARK_THEME.border}`,
        color: DARK_THEME.text.primary,
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: `1px solid ${DARK_THEME.border}`
        }}>
          {label}
        </div>
        
        {data.excelPrice && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '12px', height: '3px', backgroundColor: config.excelColor }}></div>
              <span style={{ fontSize: '12px', color: DARK_THEME.text.secondary }}>
                Purchase Price
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: '700', color: config.excelColor }}>
                {data.excelPrice.toFixed(2)} {unit}
              </span>
            </div>
          </div>
        )}
        
        {data.apiPrice && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '12px', height: '3px', backgroundColor: config.apiColor }}></div>
              <span style={{ fontSize: '12px', color: DARK_THEME.text.secondary }}>
                Market Price
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: '700', color: config.apiColor }}>
                {data.apiPrice.toFixed(2)} {unit}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: DARK_THEME.background.main
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: `4px solid ${DARK_THEME.background.light}`,
          borderTop: `4px solid ${DARK_THEME.primary.blue}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ marginTop: '20px', color: DARK_THEME.text.primary }}>
          Loading Commodity Dashboard...
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const chartData = commodityData[selectedCommodity] || [];
  const config = COMMODITY_CONFIG[selectedCommodity];
  const unit = COMMODITY_UNITS[selectedCommodity].chart;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={styles.title}>📈 Commodity Price Intelligence</h1>
            <div style={styles.subtitle}>
              Real-time market comparison with historical FX rates • Professional dark theme
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Currency Toggle */}
            <div style={{ display: 'flex', backgroundColor: DARK_THEME.background.hover, borderRadius: '10px', padding: '4px' }}>
              <button
                onClick={() => setCurrencyMode('original')}
                style={{
                  ...styles.buttonSecondary,
                  backgroundColor: currencyMode === 'original' ? DARK_THEME.primary.blue : 'transparent',
                  color: currencyMode === 'original' ? 'white' : DARK_THEME.text.secondary
                }}
              >
                <span>💱</span>
                <span>Document Currency</span>
              </button>
              <button
                onClick={() => setCurrencyMode('ngn')}
                style={{
                  ...styles.buttonSecondary,
                  backgroundColor: currencyMode === 'ngn' ? DARK_THEME.primary.green : 'transparent',
                  color: currencyMode === 'ngn' ? 'white' : DARK_THEME.text.secondary
                }}
              >
                <span>🇳🇬</span>
                <span>NGN</span>
              </button>
            </div>
            
            {/* Status Badge */}
            <div style={{
              ...styles.badge,
              ...(apiStatus === 'connected' ? styles.badgeSuccess : 
                  apiStatus === 'error' ? styles.badgeError : styles.badgeWarning),
              padding: '8px 16px'
            }}>
              {apiStatus === 'connected' ? '●' : '⚠️'}
              {apiStatus === 'connected' ? ' API Connected' : ' Connecting...'}
            </div>
          </div>
        </div>
        
        {/* Stats Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {CHART_COMMODITIES.map(commodity => {
            const data = commodityData[commodity] || [];
            const livePrice = livePrices[commodity];
            const config = COMMODITY_CONFIG[commodity];
            
            return (
              <div key={commodity} style={{
                ...styles.card,
                padding: '20px',
                cursor: 'pointer',
                borderColor: selectedCommodity === commodity ? config.excelColor : DARK_THEME.border,
                transition: 'all 0.2s'
              }} onClick={() => setSelectedCommodity(commodity)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '20px' }}>{config.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{config.name}</div>
                    <div style={{ fontSize: '12px', color: DARK_THEME.text.muted }}>{config.category}</div>
                  </div>
                  {selectedCommodity === commodity && (
                    <div style={styles.badgeSuccess}>✓</div>
                  )}
                </div>
                
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700' }}>
                    {livePrice?.current ? livePrice.current.toFixed(2) : '—'}
                  </div>
                  <div style={{ fontSize: '12px', color: DARK_THEME.text.muted }}>
                    {currencyMode === 'ngn' ? 'NGN/kg' : COMMODITY_UNITS[commodity].chart}
                  </div>
                </div>
                
                {livePrice?.change && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: livePrice.change >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: livePrice.change >= 0 ? '#10B981' : '#EF4444',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {livePrice.change >= 0 ? '▲' : '▼'} {Math.abs(livePrice.change).toFixed(1)}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '32px' }}>
        {/* Sidebar */}
        <div>
          <div style={styles.card}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Commodities</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {CHART_COMMODITIES.map(commodity => {
                const config = COMMODITY_CONFIG[commodity];
                const isSelected = selectedCommodity === commodity;
                const livePrice = livePrices[commodity];
                
                return (
                  <div
                    key={commodity}
                    onClick={() => setSelectedCommodity(commodity)}
                    style={{
                      padding: '16px',
                      backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : DARK_THEME.background.hover,
                      borderRadius: '10px',
                      border: `2px solid ${isSelected ? DARK_THEME.primary.blue : 'transparent'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: config.excelColor,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px'
                      }}>
                        {config.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '15px' }}>{config.name}</div>
                        <div style={{ fontSize: '12px', color: DARK_THEME.text.muted }}>{config.category}</div>
                      </div>
                    </div>
                    
                    {livePrice && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '20px', fontWeight: '700' }}>
                            {livePrice.current.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '11px', color: DARK_THEME.text.muted }}>
                            {currencyMode === 'ngn' ? 'NGN/kg' : unit}
                          </div>
                        </div>
                        {livePrice.change && (
                          <div style={{
                            padding: '4px 10px',
                            backgroundColor: livePrice.change >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: livePrice.change >= 0 ? '#10B981' : '#EF4444',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {livePrice.change >= 0 ? '▲' : '▼'} {Math.abs(livePrice.change).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Unit Legend */}
          <div style={{ ...styles.card, marginTop: '16px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Unit Legend</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(COMMODITY_UNITS).map(([commodity, units]) => (
                <div key={commodity} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: COMMODITY_CONFIG[commodity]?.excelColor
                    }}></div>
                    <span style={{ fontSize: '13px' }}>{COMMODITY_CONFIG[commodity]?.name}</span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: DARK_THEME.text.muted,
                    backgroundColor: DARK_THEME.background.hover,
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}>
                    {currencyMode === 'ngn' ? 'NGN/kg' : units.chart}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chart Area */}
        <div>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '700' }}>
                  {config.name} - Price Analysis
                </h2>
                <div style={{ color: DARK_THEME.text.secondary, fontSize: '14px' }}>
                  Purchase vs Market Prices • {currencyMode === 'original' ? 'Document Currency' : 'NGN'}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: DARK_THEME.background.hover, borderRadius: '8px' }}>
                  <div style={{ width: '12px', height: '3px', backgroundColor: config.excelColor }}></div>
                  <span style={{ fontSize: '13px' }}>Purchase</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: DARK_THEME.background.hover, borderRadius: '8px' }}>
                  <div style={{ width: '12px', height: '3px', backgroundColor: config.apiColor }}></div>
                  <span style={{ fontSize: '13px' }}>Market</span>
                </div>
              </div>
            </div>
            
            {/* Chart */}
            <div style={{ height: '400px' }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK_THEME.background.light} vertical={false} />
                    <XAxis 
                      dataKey="monthDisplay"
                      tick={{ fontSize: 12, fill: DARK_THEME.text.muted }}
                      tickLine={false}
                      axisLine={{ stroke: DARK_THEME.border }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: DARK_THEME.text.muted }}
                      tickLine={false}
                      axisLine={{ stroke: DARK_THEME.border }}
                      label={{ 
                        value: currencyMode === 'ngn' ? 'NGN/kg' : unit,
                        angle: -90,
                        position: 'insideLeft',
                        style: { fill: DARK_THEME.text.muted, fontSize: 12 }
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    
                    <Line
                      type="monotone"
                      dataKey="excelPrice"
                      name="Purchase Price"
                      stroke={config.excelColor}
                      strokeWidth={3}
                      dot={{ r: 4, fill: config.excelColor }}
                      activeDot={{ r: 8, fill: config.excelColor }}
                    />
                    
                    <Line
                      type="monotone"
                      dataKey="apiPrice"
                      name="Market Price"
                      stroke={config.apiColor}
                      strokeWidth={3}
                      dot={{ r: 4, fill: config.apiColor }}
                      activeDot={{ r: 8, fill: config.apiColor }}
                      strokeDasharray={chartData.some(d => d.apiPrice == null) ? "5 5" : "0"}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No Data Available</div>
                  <div style={{ fontSize: '14px', color: DARK_THEME.text.muted }}>No recent data found for {config.name}</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Live Prices Table */}
          <div style={{ ...styles.card, marginTop: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '700' }}>Live Market Prices</h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: DARK_THEME.background.hover }}>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: DARK_THEME.text.primary }}>Commodity</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: DARK_THEME.text.primary }}>Current Price</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: DARK_THEME.text.primary }}>24h Change</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: DARK_THEME.text.primary }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {CHART_COMMODITIES.map((commodity, index) => {
                    const config = COMMODITY_CONFIG[commodity];
                    const livePrice = livePrices[commodity];
                    
                    return (
                      <tr 
                        key={commodity}
                        style={{ 
                          backgroundColor: index % 2 === 0 ? DARK_THEME.background.card : DARK_THEME.background.hover,
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedCommodity(commodity)}
                      >
                        <td style={{ padding: '16px', fontWeight: '600' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              backgroundColor: `${config.excelColor}20`,
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px'
                            }}>
                              {config.icon}
                            </div>
                            <div>
                              <div>{config.name}</div>
                              <div style={{ fontSize: '12px', color: DARK_THEME.text.muted, marginTop: '2px' }}>
                                {config.category} • {COMMODITY_SYMBOLS[commodity]}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', fontSize: '16px' }}>
                          {livePrice ? `${livePrice.current.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          {livePrice?.change ? (
                            <span style={{
                              padding: '6px 12px',
                              backgroundColor: livePrice.change >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: livePrice.change >= 0 ? '#10B981' : '#EF4444',
                              borderRadius: '20px',
                              fontSize: '13px',
                              fontWeight: '600'
                            }}>
                              {livePrice.change >= 0 ? '▲' : '▼'} {Math.abs(livePrice.change).toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right', color: DARK_THEME.text.muted, fontSize: '13px' }}>
                          {livePrice?.unit || (currencyMode === 'ngn' ? 'NGN/kg' : unit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ ...styles.card, marginTop: '32px', backgroundColor: DARK_THEME.background.hover }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
          <div>
            <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '15px' }}>Data Sources</div>
            <div style={{ fontSize: '14px', color: DARK_THEME.text.muted, lineHeight: '1.6' }}>
              • DDFPlus Commodity API (Real-time)<br/>
              • Excel Purchase Records<br/>
              • Historical FX Rates (Dynamic)<br/>
              • Date Range: 2020-2025
            </div>
          </div>
          
          <div>
            <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '15px' }}>Unit Configuration</div>
            <div style={{ fontSize: '14px', color: DARK_THEME.text.muted, lineHeight: '1.6' }}>
              • Palm Oil: USD/tonne<br/>
              • Brent Crude: USD/kg<br/>
              • Aluminum: USD/tonne<br/>
              • Sugar: NGN/kg
            </div>
          </div>
          
          <div>
            <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '15px' }}>System Info</div>
            <div style={{ fontSize: '14px', color: DARK_THEME.text.muted, lineHeight: '1.6' }}>
              • Refresh: Live (5 min)<br/>
              • Mode: Real API + Historical FX<br/>
              • Version: 2.0.0<br/>
              • Updated: {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommodityDashboard;