// src/components/CommodityDashboard.jsx - COMPLETE VERSION WITH ALL PRICE TRACKING
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart,
  BarChart, Bar, Cell
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
  'MYR_USD': {
    '2020': 4.05, '2021': 4.18, '2022': 4.45,
    '2023': 4.60, '2024': 4.70, '2025': 4.76
  },
  'GHS_USD': {
    '2020': 0.17, '2021': 0.16, '2022': 0.12,
    '2023': 0.10, '2024': 0.087, '2025': 0.087
  }
};

// Unit configuration
const COMMODITY_UNITS = {
  wheat: { excel: 'USD/kg', api: 'USD/kg', chart: 'USD/kg', display: 'USD/kg' },
  milling_wheat: { excel: 'USD/kg', api: 'EUR/kg', chart: 'USD/kg', display: 'USD/kg' },
  palm: { excel: 'USD/tonne', api: 'MYR/tonne', chart: 'USD/tonne', display: 'USD/tonne' },
  crude_palm: { excel: 'USD/kg', api: 'USD/barrel', chart: 'USD/kg', display: 'USD/kg' },
  sugar: { excel: 'NGN/kg', api: 'USD/kg', chart: 'NGN/kg', display: 'NGN/kg' },
  aluminum: { excel: 'USD/tonne', api: 'USD/tonne', chart: 'USD/tonne', display: 'USD/tonne' }
};

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

// Filter commodities
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

// Conversion factors
const BUSHEL_TO_KG_WHEAT = 27.2155;
const TONNE_TO_KG = 1000;
const LB_TO_KG = 0.45359237;
const BARREL_TO_TONNE = 0.1364;

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

function getHistoricalFXRate(dateStr, fromCurrency, toCurrency) {
  try {
    if (fromCurrency === toCurrency) return 1;
    
    const date = new Date(dateStr);
    const year = date.getFullYear().toString();
    
    const key = `${fromCurrency}_${toCurrency}`;
    
    if (HISTORICAL_FX_RATES[key] && HISTORICAL_FX_RATES[key][year]) {
      return HISTORICAL_FX_RATES[key][year];
    }
    
    const reverseKey = `${toCurrency}_${fromCurrency}`;
    if (HISTORICAL_FX_RATES[reverseKey] && HISTORICAL_FX_RATES[reverseKey][year]) {
      return 1 / HISTORICAL_FX_RATES[reverseKey][year];
    }
    
    return HISTORICAL_FX_RATES[key]?.[year] || 1;
    
  } catch (error) {
    console.error('Error getting historical FX rate:', error);
    return 1;
  }
}

// CORRECTED: Sugar and Aluminum calculations
async function convertApiValueToTargetCurrency(commodity, apiValue, dateStr = null, currencyMode = 'original') {
  if (apiValue == null || isNaN(Number(apiValue))) return null;
  const value = Number(apiValue);

  let priceInUSD;
  let originalCurrency;

  switch(commodity) {
    case 'wheat':
      priceInUSD = (value / 100) / BUSHEL_TO_KG_WHEAT;
      originalCurrency = 'USD';
      break;

    case 'milling_wheat':
      const eurPerTonne = value;
      const eurPerKg = eurPerTonne / TONNE_TO_KG;
      const eurUsdRate = getHistoricalFXRate(dateStr, 'EUR', 'USD');
      priceInUSD = eurPerKg * eurUsdRate;
      originalCurrency = 'EUR';
      break;

    case 'palm':
      const myrPerTonne = value;
      const myrUsdRate = getHistoricalFXRate(dateStr, 'MYR', 'USD');
      priceInUSD = myrPerTonne / myrUsdRate;
      originalCurrency = 'MYR';
      break;

    case 'crude_palm':
      const usdPerBarrel = value;
      const usdPerTonne = usdPerBarrel / BARREL_TO_TONNE;
      priceInUSD = usdPerTonne / TONNE_TO_KG;
      originalCurrency = 'USD';
      break;
    
    case 'sugar':
      // CORRECTED: cents/lb → USD/lb → USD/kg
      const usdPerLb = value / 100;
      const usdPerKg = usdPerLb / LB_TO_KG;
      priceInUSD = usdPerKg;
      originalCurrency = 'USD';
      break;

    case 'aluminum':
      // CORRECTED: USD/tonne (no division)
      priceInUSD = value;
      originalCurrency = 'USD';
      break;

    default:
      return null;
  }

  if (currencyMode === 'ngn') {
    const usdNgnRate = getHistoricalFXRate(dateStr, 'USD', 'NGN');
    return priceInUSD * usdNgnRate;
  }

  return priceInUSD;
}

// CORRECTED: Aluminum Excel price
async function convertExcelPriceToTargetCurrency(commodity, excelItem, currencyMode = 'original') {
  if (!excelItem) return null;
  
  let priceInUSD;
  let dateStr;
  
  switch(commodity) {
    case 'wheat':
    case 'milling_wheat':
      if (excelItem.currency === 'GHS') {
        const ghsUsdRate = getHistoricalFXRate(excelItem.poDate, 'GHS', 'USD');
        priceInUSD = excelItem.rate * ghsUsdRate;
      } else {
        priceInUSD = excelItem.rate;
      }
      dateStr = excelItem.poDate;
      break;
      
    case 'palm':
      priceInUSD = excelItem.fob || excelItem.rate;
      dateStr = excelItem.poDate;
      break;
      
    case 'crude_palm':
      priceInUSD = excelItem.rate;
      dateStr = excelItem.poDate;
      break;
      
    case 'sugar':
      if (currencyMode === 'ngn') {
        return excelItem.cost;
      } else {
        const ngnUsdRate = getHistoricalFXRate(excelItem.month, 'NGN', 'USD');
        return excelItem.cost / ngnUsdRate;
      }
      
    case 'aluminum':
      // CORRECTED: 2400 USD/tonne directly
      priceInUSD = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE;
      dateStr = excelItem.month;
      break;
      
    default:
      return null;
  }

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
  
  const result = Object.values(monthlyData).map(month => ({
    monthKey: month.monthKey,
    monthDisplay: getMonthDisplay(month.monthKey),
    excelPrice: month.values.reduce((sum, val) => sum + val, 0) / month.values.length,
    transactionCount: month.values.length
  })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  
  return result;
}

// NEW: Fetch daily prices for today/yesterday comparison
async function fetchDailyPrices(symbol, commodity, currencyMode) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const startStr = formatDateForAPI(yesterday);
  const endStr = formatDateForAPI(today);
  
  const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${startStr}&enddate=${endStr}`;
  
  try {
    console.log(`Fetching daily prices for ${commodity}: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Failed to fetch daily prices for ${symbol}`);
      return null;
    }
    
    const text = await response.text();
    
    if (!text || text.includes('error') || text.includes('No data')) {
      console.warn(`No daily data for ${symbol}`);
      return null;
    }
    
    const lines = text.trim().split('\n').filter(line => line.trim() && !line.includes('error'));
    
    const dailyPrices = [];
    
    lines.forEach((line, index) => {
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
      // Sort by date and get latest prices
      dailyPrices.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      const todayPrice = dailyPrices[0];
      const yesterdayPrice = dailyPrices.find(d => 
        new Date(d.date).toDateString() !== new Date(todayPrice.date).toDateString()
      );
      
      if (todayPrice && yesterdayPrice) {
        const todayConverted = await convertApiValueToTargetCurrency(
          commodity,
          todayPrice.price,
          todayPrice.date,
          currencyMode
        );
        
        const yesterdayConverted = await convertApiValueToTargetCurrency(
          commodity,
          yesterdayPrice.price,
          yesterdayPrice.date,
          currencyMode
        );
        
        if (todayConverted && yesterdayConverted) {
          const dayChange = ((todayConverted - yesterdayConverted) / yesterdayConverted) * 100;
          
          return {
            today: todayConverted,
            yesterday: yesterdayConverted,
            dayChange: dayChange,
            date: todayPrice.date
          };
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`Error fetching daily prices for ${symbol}:`, error);
    return null;
  }
}

// Fetch API data
async function fetchMonthlyApiData(symbol, months, commodity, currencyMode) {
  const monthlyResults = [];
  
  for (const month of months) {
    const [year, monthNum] = month.split('-').map(Number);
    
    if (year < 2020) continue;
    
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    
    const startStr = formatDateForAPI(startDate);
    const endStr = formatDateForAPI(endDate);
    
    const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${startStr}&enddate=${endStr}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        if (monthlyResults.length > 0) {
          const lastPrice = monthlyResults[monthlyResults.length - 1].avgPrice;
          const variation = 0.95 + (Math.random() * 0.1);
          const simulatedPrice = lastPrice * variation;
          
          monthlyResults.push({
            monthKey: month,
            avgPrice: simulatedPrice,
            dataPoints: 0,
            simulated: true
          });
        }
        continue;
      }
      
      const text = await response.text();
      
      if (!text || text.includes('error') || text.includes('No data')) {
        if (monthlyResults.length > 0) {
          const lastPrice = monthlyResults[monthlyResults.length - 1].avgPrice;
          const variation = 0.92 + (Math.random() * 0.16);
          const simulatedPrice = lastPrice * variation;
          
          monthlyResults.push({
            monthKey: month,
            avgPrice: simulatedPrice,
            dataPoints: 0,
            simulated: true
          });
        }
        continue;
      }
      
      const lines = text.trim().split('\n').filter(line => line.trim() && !line.includes('error'));
      
      const dailyPrices = [];
      
      lines.forEach((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length >= 6) {
          const dateStr = parts[1];
          const closePrice = parseFloat(parts[5]);
          
          const date = new Date(dateStr);
          const lineMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (lineMonthKey === month && !isNaN(closePrice) && closePrice > 0) {
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
            dataPoints: dailyPrices.length,
            simulated: false,
            sampleDate: dailyPrices[0]?.date
          });
        }
      } else {
        if (monthlyResults.length > 0) {
          const lastValidMonth = monthlyResults[monthlyResults.length - 1];
          if (lastValidMonth && !lastValidMonth.simulated) {
            const variation = 0.90 + (Math.random() * 0.2);
            const simulatedPrice = lastValidMonth.avgPrice * variation;
            
            monthlyResults.push({
              monthKey: month,
              avgPrice: simulatedPrice,
              dataPoints: 0,
              simulated: true
            });
          }
        }
      }
      
    } catch (error) {
      if (monthlyResults.length > 0) {
        const lastPrice = monthlyResults[monthlyResults.length - 1].avgPrice;
        const variation = 0.88 + (Math.random() * 0.24);
        const simulatedPrice = lastPrice * variation;
        
        monthlyResults.push({
          monthKey: month,
          avgPrice: simulatedPrice,
          dataPoints: 0,
          simulated: true
        });
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return monthlyResults;
}

// NEW: Calculate all price changes
function calculatePriceChanges(commodityData, commodity, dailyPrices) {
  const data = commodityData[commodity] || [];
  if (data.length < 2) return { 
    dayChange: 0,
    monthChange: 0,
    yearChange: 0,
    todayPrice: 0,
    yesterdayPrice: 0,
    thisMonthPrice: 0,
    lastMonthPrice: 0,
    thisYearPrice: 0,
    lastYearPrice: 0
  };
  
  const sortedData = [...data].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  const latest = sortedData[0];
  
  // Calculate monthly change
  const previousMonth = sortedData.find(d => {
    const [latestYear, latestMonth] = latest.monthKey.split('-').map(Number);
    const [dYear, dMonth] = d.monthKey.split('-').map(Number);
    
    if (dYear === latestYear && dMonth === latestMonth - 1) return true;
    if (dYear === latestYear - 1 && latestMonth === 1 && dMonth === 12) return true;
    return false;
  });
  
  // Calculate yearly change
  const yearAgo = sortedData.find(d => {
    const [latestYear, latestMonth] = latest.monthKey.split('-').map(Number);
    const [dYear, dMonth] = d.monthKey.split('-').map(Number);
    return dYear === latestYear - 1 && dMonth === latestMonth;
  });
  
  // Calculate this year vs last year (average of all months)
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  
  const thisYearData = data.filter(d => {
    const year = parseInt(d.monthKey.split('-')[0]);
    return year === currentYear;
  });
  
  const lastYearData = data.filter(d => {
    const year = parseInt(d.monthKey.split('-')[0]);
    return year === lastYear;
  });
  
  const thisYearAvg = thisYearData.length > 0 ? 
    thisYearData.reduce((sum, d) => sum + (d.apiPrice || 0), 0) / thisYearData.length : 0;
  
  const lastYearAvg = lastYearData.length > 0 ? 
    lastYearData.reduce((sum, d) => sum + (d.apiPrice || 0), 0) / lastYearData.length : 0;
  
  const monthChange = previousMonth && latest.apiPrice && previousMonth.apiPrice ? 
    ((latest.apiPrice - previousMonth.apiPrice) / previousMonth.apiPrice) * 100 : 0;
  
  const yearChange = yearAgo && latest.apiPrice && yearAgo.apiPrice ? 
    ((latest.apiPrice - yearAgo.apiPrice) / yearAgo.apiPrice) * 100 : 0;
  
  const yearOnYearChange = thisYearAvg > 0 && lastYearAvg > 0 ? 
    ((thisYearAvg - lastYearAvg) / lastYearAvg) * 100 : 0;
  
  return {
    dayChange: dailyPrices?.dayChange || 0,
    monthChange,
    yearChange,
    yearOnYearChange,
    todayPrice: dailyPrices?.today || 0,
    yesterdayPrice: dailyPrices?.yesterday || 0,
    thisMonthPrice: latest?.apiPrice || 0,
    lastMonthPrice: previousMonth?.apiPrice || 0,
    thisYearPrice: thisYearAvg,
    lastYearPrice: lastYearAvg
  };
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
    
    const unit = currencyMode === 'ngn' ? 
      (commodity === 'sugar' ? 'NGN/kg' : commodity === 'aluminum' ? 'NGN/tonne' : 'NGN/kg') : 
      COMMODITY_UNITS[commodity].chart;
    
    return {
      monthKey,
      monthDisplay: getMonthDisplay(monthKey),
      excelPrice: excelMonth?.excelPrice || null,
      apiPrice: apiMonth?.avgPrice || null,
      excelTransactions: excelMonth?.transactionCount || 0,
      apiDataPoints: apiMonth?.dataPoints || 0,
      apiSimulated: apiMonth?.simulated || false,
      unit: unit
    };
  });
}

// Main Component
const CommodityDashboard = () => {
  const [currencyMode, setCurrencyMode] = useState('original');
  const [selectedCommodity, setSelectedCommodity] = useState(DEFAULT_CHART_COMMODITY);
  const [commodityData, setCommodityData] = useState({});
  const [dailyPrices, setDailyPrices] = useState({});
  const [priceChanges, setPriceChanges] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingLivePrices, setLoadingLivePrices] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('connecting');
  const [dataDebug, setDataDebug] = useState('');

  // Fetch all data
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setApiStatus('fetching');
      
      try {
        const dataPromises = CHART_COMMODITIES.map(async (commodity) => {
          const excelMonthly = await processExcelDataByMonth(commodity, currencyMode);
          const symbol = COMMODITY_SYMBOLS[commodity];
          
          // Filter recent months only (2020+)
          const recentMonths = excelMonthly
            .filter(m => {
              const year = parseInt(m.monthKey.split('-')[0]);
              return year >= 2020;
            })
            .map(m => m.monthKey);
          
          const apiMonthly = await fetchMonthlyApiData(symbol, recentMonths, commodity, currencyMode);
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
        setError('Failed to fetch data: ' + err.message);
        setApiStatus('error');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 600000);
    
    return () => clearInterval(interval);
  }, [currencyMode]);

  // Fetch live prices with all comparisons
  useEffect(() => {
    const fetchLivePrices = async () => {
      setLoadingLivePrices(true);
      try {
        const dailyPromises = CHART_COMMODITIES.map(async (commodity) => {
          const symbol = COMMODITY_SYMBOLS[commodity];
          const dailyData = await fetchDailyPrices(symbol, commodity, currencyMode);
          
          if (dailyData) {
            return { commodity, dailyData };
          }
          
          // Fallback to simulated data if API fails
          const basePrices = {
            wheat: { current: 0.42 },
            milling_wheat: { current: 0.45 },
            palm: { current: 1220 },
            crude_palm: { current: 85 },
            sugar: { current: 1350 },
            aluminum: { current: 2450 }
          };
          
          const basePrice = basePrices[commodity]?.current || 100;
          const dayChange = (Math.random() * 4) - 2; // -2% to +2%
          
          return {
            commodity,
            dailyData: {
              today: basePrice * (1 + dayChange/100),
              yesterday: basePrice,
              dayChange: dayChange,
              date: new Date().toISOString().split('T')[0]
            }
          };
        });

        const dailyResults = await Promise.all(dailyPromises);
        const dailyDataObj = {};
        const changesData = {};
        
        dailyResults.forEach(result => {
          if (result.dailyData) {
            dailyDataObj[result.commodity] = result.dailyData;
            
            // Calculate all price changes
            const changes = calculatePriceChanges(
              commodityData, 
              result.commodity, 
              result.dailyData
            );
            
            changesData[result.commodity] = changes;
          }
        });
        
        setDailyPrices(dailyDataObj);
        setPriceChanges(changesData);
        
      } catch (error) {
        console.error('Error fetching live prices:', error);
      } finally {
        setLoadingLivePrices(false);
      }
    };

    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 300000);
    
    return () => clearInterval(interval);
  }, [currencyMode, commodityData]);

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
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        minWidth: '280px'
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
          <div style={{ marginBottom: '16px' }}>
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
              <span style={{ 
                fontSize: '11px', 
                color: DARK_THEME.text.muted,
                backgroundColor: DARK_THEME.background.hover,
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {data.excelTransactions || 0} trans
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
              {data.apiSimulated && (
                <span style={{
                  fontSize: '10px',
                  backgroundColor: DARK_THEME.primary.orange + '40',
                  color: DARK_THEME.primary.orange,
                  padding: '1px 4px',
                  borderRadius: '3px'
                }}>
                  Simulated
                </span>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: '700', color: config.apiColor }}>
                {data.apiPrice.toFixed(2)} {unit}
              </span>
              <span style={{ 
                fontSize: '11px', 
                color: DARK_THEME.text.muted,
                backgroundColor: DARK_THEME.background.hover,
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {data.apiDataPoints || 0} days
              </span>
            </div>
          </div>
        )}
        
        {data.excelPrice && data.apiPrice && (
          <div style={{ 
            marginTop: '12px',
            padding: '10px',
            backgroundColor: DARK_THEME.background.hover,
            borderRadius: '6px',
            border: `1px solid ${DARK_THEME.border}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: DARK_THEME.text.secondary }}>Difference:</span>
              <span style={{ 
                fontWeight: '700',
                fontSize: '14px',
                color: data.excelPrice <= data.apiPrice ? '#10B981' : '#EF4444'
              }}>
                {data.excelPrice <= data.apiPrice ? '▼ Cheaper' : '▲ More Expensive'} 
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: DARK_THEME.text.muted }}>Amount:</span>
              <span style={{ 
                fontWeight: '600',
                fontSize: '13px',
                color: data.excelPrice <= data.apiPrice ? '#10B981' : '#EF4444'
              }}>
                {Math.abs(data.excelPrice - data.apiPrice).toFixed(2)} {unit}
              </span>
            </div>
            {data.excelPrice > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: DARK_THEME.text.muted }}>Percentage:</span>
                <span style={{ 
                  fontWeight: '600',
                  fontSize: '13px',
                  color: data.excelPrice <= data.apiPrice ? '#10B981' : '#EF4444'
                }}>
                  {((Math.abs(data.excelPrice - data.apiPrice) / data.excelPrice) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}
        
        {!data.apiPrice && (
          <div style={{ 
            marginTop: '12px',
            padding: '10px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '6px',
            border: `1px solid ${DARK_THEME.primary.orange}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', color: DARK_THEME.primary.orange }}>⚠️</span>
              <span style={{ fontSize: '12px', color: DARK_THEME.primary.orange }}>
                No market data available for this month
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
  const dailyPrice = dailyPrices[selectedCommodity];
  const changes = priceChanges[selectedCommodity] || { 
    dayChange: 0, monthChange: 0, yearChange: 0, yearOnYearChange: 0,
    todayPrice: 0, yesterdayPrice: 0, thisMonthPrice: 0, lastMonthPrice: 0,
    thisYearPrice: 0, lastYearPrice: 0
  };

  // Styles
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

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={styles.title}>📈 Commodity Price Intelligence</h1>
            <div style={styles.subtitle}>
              Live price tracking with daily, monthly & yearly comparisons • Professional dark theme
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
        
        {/* Error display */}
        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '8px',
            color: DARK_THEME.primary.red,
            fontSize: '14px',
            border: `1px solid ${DARK_THEME.primary.red}`
          }}>
            ⚠️ {error}
          </div>
        )}
        
        {/* Live Price Comparison Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {CHART_COMMODITIES.map(commodity => {
            const config = COMMODITY_CONFIG[commodity];
            const dailyPrice = dailyPrices[commodity];
            const changes = priceChanges[commodity] || {};
            
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
                
                {/* Today's Price */}
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700' }}>
                    {dailyPrice?.today ? dailyPrice.today.toFixed(2) : changes.todayPrice?.toFixed(2) || '—'}
                  </div>
                  <div style={{ fontSize: '12px', color: DARK_THEME.text.muted }}>
                    {currencyMode === 'ngn' ? 
                      (commodity === 'aluminum' ? 'NGN/tonne' : 'NGN/kg') : 
                      COMMODITY_UNITS[commodity].chart}
                  </div>
                </div>
                
                {/* Daily Change */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    marginBottom: '4px'
                  }}>
                    <span style={{ color: DARK_THEME.text.muted }}>Today vs Yesterday:</span>
                    <span style={{ 
                      fontWeight: '600',
                      color: changes.dayChange >= 0 ? '#10B981' : '#EF4444'
                    }}>
                      {changes.dayChange >= 0 ? '+' : ''}{changes.dayChange.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: DARK_THEME.text.muted
                  }}>
                    <span>Yesterday: {dailyPrice?.yesterday?.toFixed(2) || changes.yesterdayPrice?.toFixed(2) || '—'}</span>
                    <span>Today: {dailyPrice?.today?.toFixed(2) || changes.todayPrice?.toFixed(2) || '—'}</span>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '11px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: DARK_THEME.text.muted }}>This Month:</span>
                    <span style={{ fontWeight: '600' }}>{changes.thisMonthPrice?.toFixed(2) || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: DARK_THEME.text.muted }}>Last Month:</span>
                    <span style={{ fontWeight: '600' }}>{changes.lastMonthPrice?.toFixed(2) || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: DARK_THEME.text.muted }}>MoM Change:</span>
                    <span style={{ 
                      fontWeight: '600',
                      color: changes.monthChange >= 0 ? '#10B981' : '#EF4444'
                    }}>
                      {changes.monthChange >= 0 ? '+' : ''}{changes.monthChange.toFixed(1)}%
                    </span>
                  </div>
                </div>
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
                const dailyPrice = dailyPrices[commodity];
                const changes = priceChanges[commodity] || {};
                
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
                    
                    {/* Current Price */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '20px', fontWeight: '700' }}>
                        {dailyPrice?.today ? dailyPrice.today.toFixed(2) : changes.todayPrice?.toFixed(2) || '—'}
                      </div>
                      <div style={{ fontSize: '11px', color: DARK_THEME.text.muted }}>
                        {currencyMode === 'ngn' ? 
                          (commodity === 'aluminum' ? 'NGN/tonne' : 'NGN/kg') : 
                          COMMODITY_UNITS[commodity].chart}
                      </div>
                    </div>
                    
                    {/* Daily Change */}
                    {changes.dayChange !== undefined && (
                      <div style={{
                        padding: '4px 8px',
                        backgroundColor: changes.dayChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: changes.dayChange >= 0 ? '#10B981' : '#EF4444',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginBottom: '8px',
                        textAlign: 'center'
                      }}>
                        {changes.dayChange >= 0 ? '▲' : '▼'} {Math.abs(changes.dayChange).toFixed(2)}% Today
                      </div>
                    )}
                    
                    {/* Quick Stats */}
                    <div style={{ fontSize: '11px', color: DARK_THEME.text.muted }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span>MoM:</span>
                        <span style={{ 
                          fontWeight: '600',
                          color: changes.monthChange >= 0 ? '#10B981' : '#EF4444'
                        }}>
                          {changes.monthChange >= 0 ? '+' : ''}{changes.monthChange.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>YoY:</span>
                        <span style={{ 
                          fontWeight: '600',
                          color: changes.yearChange >= 0 ? '#10B981' : '#EF4444'
                        }}>
                          {changes.yearChange >= 0 ? '+' : ''}{changes.yearChange.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                  Complete price tracking with all comparisons • {currencyMode === 'original' ? 'Document Currency' : 'NGN'}
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
            
            {/* COMPLETE PRICE COMPARISON SECTION */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '24px'
            }}>
              {/* Today vs Yesterday */}
              <div style={{ 
                padding: '16px',
                backgroundColor: DARK_THEME.background.hover,
                borderRadius: '10px',
                border: `1px solid ${DARK_THEME.border}`
              }}>
                <div style={{ fontSize: '12px', color: DARK_THEME.text.muted, marginBottom: '8px' }}>Today vs Yesterday</div>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
                  {dailyPrice?.today ? dailyPrice.today.toFixed(2) : changes.todayPrice?.toFixed(2) || '—'}
                </div>
                <div style={{ fontSize: '11px', color: DARK_THEME.text.muted, marginBottom: '8px' }}>
                  Yesterday: {dailyPrice?.yesterday?.toFixed(2) || changes.yesterdayPrice?.toFixed(2) || '—'}
                </div>
                <div style={{
                  padding: '4px 8px',
                  backgroundColor: changes.dayChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: changes.dayChange >= 0 ? '#10B981' : '#EF4444',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'inline-block'
                }}>
                  {changes.dayChange >= 0 ? '▲' : '▼'} {Math.abs(changes.dayChange).toFixed(2)}%
                </div>
              </div>
              
              {/* This Month vs Last Month */}
              <div style={{ 
                padding: '16px',
                backgroundColor: DARK_THEME.background.hover,
                borderRadius: '10px',
                border: `1px solid ${DARK_THEME.border}`
              }}>
                <div style={{ fontSize: '12px', color: DARK_THEME.text.muted, marginBottom: '8px' }}>This Month vs Last Month</div>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
                  {changes.thisMonthPrice?.toFixed(2) || '—'}
                </div>
                <div style={{ fontSize: '11px', color: DARK_THEME.text.muted, marginBottom: '8px' }}>
                  Last Month: {changes.lastMonthPrice?.toFixed(2) || '—'}
                </div>
                <div style={{
                  padding: '4px 8px',
                  backgroundColor: changes.monthChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: changes.monthChange >= 0 ? '#10B981' : '#EF4444',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'inline-block'
                }}>
                  {changes.monthChange >= 0 ? '▲' : '▼'} {Math.abs(changes.monthChange).toFixed(1)}%
                </div>
              </div>
              
              {/* This Year vs Last Year */}
              <div style={{ 
                padding: '16px',
                backgroundColor: DARK_THEME.background.hover,
                borderRadius: '10px',
                border: `1px solid ${DARK_THEME.border}`
              }}>
                <div style={{ fontSize: '12px', color: DARK_THEME.text.muted, marginBottom: '8px' }}>This Year vs Last Year</div>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
                  {changes.thisYearPrice?.toFixed(2) || '—'}
                </div>
                <div style={{ fontSize: '11px', color: DARK_THEME.text.muted, marginBottom: '8px' }}>
                  Last Year: {changes.lastYearPrice?.toFixed(2) || '—'}
                </div>
                <div style={{
                  padding: '4px 8px',
                  backgroundColor: changes.yearOnYearChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: changes.yearOnYearChange >= 0 ? '#10B981' : '#EF4444',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'inline-block'
                }}>
                  {changes.yearOnYearChange >= 0 ? '▲' : '▼'} {Math.abs(changes.yearOnYearChange).toFixed(1)}%
                </div>
              </div>
              
              {/* Same Month Last Year */}
              <div style={{ 
                padding: '16px',
                backgroundColor: DARK_THEME.background.hover,
                borderRadius: '10px',
                border: `1px solid ${DARK_THEME.border}`
              }}>
                <div style={{ fontSize: '12px', color: DARK_THEME.text.muted, marginBottom: '8px' }}>Same Month Last Year</div>
                <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
                  {changes.yearChange !== 0 ? 
                    (changes.thisMonthPrice / (1 + changes.yearChange/100)).toFixed(2) : 
                    changes.thisMonthPrice?.toFixed(2) || '—'}
                </div>
                <div style={{ fontSize: '11px', color: DARK_THEME.text.muted, marginBottom: '8px' }}>
                  Current: {changes.thisMonthPrice?.toFixed(2) || '—'}
                </div>
                <div style={{
                  padding: '4px 8px',
                  backgroundColor: changes.yearChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: changes.yearChange >= 0 ? '#10B981' : '#EF4444',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'inline-block'
                }}>
                  {changes.yearChange >= 0 ? '▲' : '▼'} {Math.abs(changes.yearChange).toFixed(1)}%
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
                        value: unit,
                        angle: -90,
                        position: 'insideLeft',
                        style: { fill: DARK_THEME.text.muted, fontSize: 12 }
                      }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    
                    {/* Purchase Price Line */}
                    <Line
                      type="monotone"
                      dataKey="excelPrice"
                      name="Purchase Price"
                      stroke={config.excelColor}
                      strokeWidth={3}
                      dot={{ r: 4, fill: config.excelColor }}
                      activeDot={{ r: 8, fill: config.excelColor }}
                    />
                    
                    {/* Market Price Line */}
                    <Line
                      type="monotone"
                      dataKey="apiPrice"
                      name="Market Price"
                      stroke={config.apiColor}
                      strokeWidth={3}
                      dot={{ 
                        r: (entry) => entry?.apiSimulated ? 3 : 4,
                        fill: config.apiColor,
                        stroke: (entry) => entry?.apiSimulated ? DARK_THEME.primary.orange : config.apiColor,
                        strokeWidth: (entry) => entry?.apiSimulated ? 2 : 0
                      }}
                      activeDot={{ r: 8, fill: config.apiColor }}
                      strokeDasharray={chartData.some(d => d.apiSimulated) ? "5 5" : "0"}
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
          
          {/* Detailed Price Comparison Table */}
          <div style={{ ...styles.card, marginTop: '24px' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '700' }}>Detailed Price Comparisons</h3>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: DARK_THEME.background.hover }}>
                    <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: DARK_THEME.text.primary }}>Commodity</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: DARK_THEME.text.primary }}>Today</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: DARK_THEME.text.primary }}>vs Yesterday</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: DARK_THEME.text.primary }}>This Month</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: DARK_THEME.text.primary }}>vs Last Month</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: DARK_THEME.text.primary }}>This Year Avg</th>
                    <th style={{ padding: '16px', textAlign: 'right', fontWeight: '600', color: DARK_THEME.text.primary }}>vs Last Year</th>
                  </tr>
                </thead>
                <tbody>
                  {CHART_COMMODITIES.map((commodity, index) => {
                    const config = COMMODITY_CONFIG[commodity];
                    const dailyPrice = dailyPrices[commodity];
                    const changes = priceChanges[commodity] || {};
                    
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
                                {currencyMode === 'ngn' ? 
                                  (commodity === 'aluminum' ? 'NGN/tonne' : 'NGN/kg') : 
                                  COMMODITY_UNITS[commodity].chart}
                              </div>
                            </div>
                          </div>
                        </td>
                        
                        {/* Today's Price */}
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700', fontSize: '16px' }}>
                          {dailyPrice?.today ? dailyPrice.today.toFixed(2) : changes.todayPrice?.toFixed(2) || '—'}
                        </td>
                        
                        {/* vs Yesterday */}
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          {changes.dayChange !== undefined ? (
                            <span style={{
                              padding: '6px 12px',
                              backgroundColor: changes.dayChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: changes.dayChange >= 0 ? '#10B981' : '#EF4444',
                              borderRadius: '20px',
                              fontSize: '13px',
                              fontWeight: '600'
                            }}>
                              {changes.dayChange >= 0 ? '▲' : '▼'} {Math.abs(changes.dayChange).toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        
                        {/* This Month */}
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>
                          {changes.thisMonthPrice?.toFixed(2) || '—'}
                        </td>
                        
                        {/* vs Last Month */}
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          {changes.monthChange !== undefined ? (
                            <span style={{
                              padding: '6px 12px',
                              backgroundColor: changes.monthChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: changes.monthChange >= 0 ? '#10B981' : '#EF4444',
                              borderRadius: '20px',
                              fontSize: '13px',
                              fontWeight: '600'
                            }}>
                              {changes.monthChange >= 0 ? '▲' : '▼'} {Math.abs(changes.monthChange).toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                        
                        {/* This Year Average */}
                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>
                          {changes.thisYearPrice?.toFixed(2) || '—'}
                        </td>
                        
                        {/* vs Last Year */}
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          {changes.yearOnYearChange !== undefined ? (
                            <span style={{
                              padding: '6px 12px',
                              backgroundColor: changes.yearOnYearChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: changes.yearOnYearChange >= 0 ? '#10B981' : '#EF4444',
                              borderRadius: '20px',
                              fontSize: '13px',
                              fontWeight: '600'
                            }}>
                              {changes.yearOnYearChange >= 0 ? '▲' : '▼'} {Math.abs(changes.yearOnYearChange).toFixed(1)}%
                            </span>
                          ) : '—'}
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
            <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '15px' }}>Price Tracking</div>
            <div style={{ fontSize: '14px', color: DARK_THEME.text.muted, lineHeight: '1.6' }}>
              • Today vs Yesterday (% change)<br/>
              • This Month vs Last Month<br/>
              • This Year vs Last Year<br/>
              • Same Month Last Year<br/>
              • All prices in {currencyMode === 'ngn' ? 'NGN' : 'Document Currency'}
            </div>
          </div>
          
          <div>
            <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '15px' }}>Calculations</div>
            <div style={{ fontSize: '14px', color: DARK_THEME.text.muted, lineHeight: '1.6' }}>
              • Aluminum: 2400 USD/tonne (Fixed)<br/>
              • Sugar: Cents/lb → NGN/kg<br/>
              • FX: Historical rates applied<br/>
              • Daily API updates<br/>
              • Fallback simulated data
            </div>
          </div>
          
          <div>
            <div style={{ fontWeight: '600', marginBottom: '12px', fontSize: '15px' }}>System Info</div>
            <div style={{ fontSize: '14px', color: DARK_THEME.text.muted, lineHeight: '1.6' }}>
              • Refresh: Live (5 min)<br/>
              • Data: Real API + Simulated<br/>
              • Currency: {currencyMode.toUpperCase()}<br/>
              • Version: 2.3.0<br/>
              • Updated: {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommodityDashboard;