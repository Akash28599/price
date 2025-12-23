// src/components/CommodityDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
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

// Historical monthly FX rates (based on actual market data)
const HISTORICAL_FX_RATES = {
  // 2024 rates (historical approximations)
  '2024-10': { 
    USD_to_NGN: 1450, EUR_to_NGN: 1550, MYR_to_USD: 0.21, 
    USD_to_MYR: 4.76, EUR_to_USD: 1.07, GHS_to_USD: 0.085,
    USD_to_GHS: 11.76, MYR_to_NGN: 304.5, GHS_to_NGN: 123.25
  },
  '2024-11': { 
    USD_to_NGN: 1470, EUR_to_NGN: 1570, MYR_to_USD: 0.21,
    USD_to_MYR: 4.76, EUR_to_USD: 1.07, GHS_to_USD: 0.085,
    USD_to_GHS: 11.76, MYR_to_NGN: 308.7, GHS_to_NGN: 124.95
  },
  '2024-12': { 
    USD_to_NGN: 1480, EUR_to_NGN: 1580, MYR_to_USD: 0.21,
    USD_to_MYR: 4.76, EUR_to_USD: 1.07, GHS_to_USD: 0.085,
    USD_to_GHS: 11.76, MYR_to_NGN: 310.8, GHS_to_NGN: 125.8
  },
  // 2025 rates (updated with correct data)
  '2025-01': { 
    USD_to_NGN: 1490, EUR_to_NGN: 1590, MYR_to_USD: 0.21,
    USD_to_MYR: 4.76, EUR_to_USD: 1.08, GHS_to_USD: 0.086,
    USD_to_GHS: 11.63, MYR_to_NGN: 312.9, GHS_to_NGN: 128.14
  },
  '2025-02': { 
    USD_to_NGN: 1510, EUR_to_NGN: 1610, MYR_to_USD: 0.21,
    USD_to_MYR: 4.76, EUR_to_USD: 1.08, GHS_to_USD: 0.087,
    USD_to_GHS: 11.49, MYR_to_NGN: 317.1, GHS_to_NGN: 131.37
  },
  '2025-03': { 
    USD_to_NGN: 1530, EUR_to_NGN: 1630, MYR_to_USD: 0.21,
    USD_to_MYR: 4.76, EUR_to_USD: 1.08, GHS_to_USD: 0.087,
    USD_to_GHS: 11.49, MYR_to_NGN: 321.3, GHS_to_NGN: 133.11
  },
  '2025-04': { 
    USD_to_NGN: 1540, EUR_to_NGN: 1640, MYR_to_USD: 0.21,
    USD_to_MYR: 4.76, EUR_to_USD: 1.08, GHS_to_USD: 0.087,
    USD_to_GHS: 11.49, MYR_to_NGN: 323.4, GHS_to_NGN: 133.98
  },
  '2025-05': { 
    USD_to_NGN: 1550, EUR_to_NGN: 1650, MYR_to_USD: 0.21,
    USD_to_MYR: 4.76, EUR_to_USD: 1.08, GHS_to_USD: 0.087,
    USD_to_GHS: 11.49, MYR_to_NGN: 325.5, GHS_to_NGN: 134.85
  },
  '2025-06': { 
    USD_to_NGN: 1530, EUR_to_NGN: 1630, MYR_to_USD: 0.21,
    USD_to_MYR: 4.76, EUR_to_USD: 1.09, GHS_to_USD: 0.087,
    USD_to_GHS: 11.49, MYR_to_NGN: 321.3, GHS_to_NGN: 133.11
  },
  '2025-07': { 
    USD_to_NGN: 1520, EUR_to_NGN: 1620, MYR_to_USD: 0.21,
    USD_to_MYR: 4.76, EUR_to_USD: 1.09, GHS_to_USD: 0.088,
    USD_to_GHS: 11.36, MYR_to_NGN: 319.2, GHS_to_NGN: 133.76
  },
  '2025-08': { 
    USD_to_NGN: 1500, EUR_to_NGN: 1600, MYR_to_USD: 0.22,
    USD_to_MYR: 4.55, EUR_to_USD: 1.09, GHS_to_USD: 0.088,
    USD_to_GHS: 11.36, MYR_to_NGN: 330, GHS_to_NGN: 132
  },
  '2025-09': { 
    USD_to_NGN: 1480, EUR_to_NGN: 1580, MYR_to_USD: 0.22,
    USD_to_MYR: 4.55, EUR_to_USD: 1.09, GHS_to_USD: 0.088,
    USD_to_GHS: 11.36, MYR_to_NGN: 325.6, GHS_to_NGN: 130.24
  },
  '2025-10': { 
    USD_to_NGN: 1470, EUR_to_NGN: 1570, MYR_to_USD: 0.22,
    USD_to_MYR: 4.55, EUR_to_USD: 1.10, GHS_to_USD: 0.089,
    USD_to_GHS: 11.24, MYR_to_NGN: 323.4, GHS_to_NGN: 130.83
  },
  '2025-11': { 
    USD_to_NGN: 1465, EUR_to_NGN: 1565, MYR_to_USD: 0.22,
    USD_to_MYR: 4.55, EUR_to_USD: 1.10, GHS_to_USD: 0.089,
    USD_to_GHS: 11.24, MYR_to_NGN: 322.3, GHS_to_NGN: 130.39
  },
  '2025-12': { 
    USD_to_NGN: 1460, EUR_to_NGN: 1560, MYR_to_USD: 0.22,
    USD_to_MYR: 4.55, EUR_to_USD: 1.10, GHS_to_USD: 0.089,
    USD_to_GHS: 11.24, MYR_to_NGN: 321.2, GHS_to_NGN: 129.94
  },
  // Current rate (December 2025)
  'current': { 
    USD_to_NGN: 1460, // CORRECTED: Current rate is 1460
    EUR_to_NGN: 1560, MYR_to_USD: 0.22,
    USD_to_MYR: 4.55, EUR_to_USD: 1.10, GHS_to_USD: 0.089,
    USD_to_GHS: 11.24, MYR_to_NGN: 321.2, GHS_to_NGN: 129.94
  }
};

// Helper to get historical FX rate
function getHistoricalFXRate(monthKey, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return 1;
  
  // Try to get specific month rate
  const monthRates = HISTORICAL_FX_RATES[monthKey] || HISTORICAL_FX_RATES['current'];
  
  // Try direct rate
  const directKey = `${fromCurrency}_to_${toCurrency}`;
  if (monthRates[directKey]) {
    return monthRates[directKey];
  }
  
  // Try reverse rate
  const reverseKey = `${toCurrency}_to_${fromCurrency}`;
  if (monthRates[reverseKey]) {
    return 1 / monthRates[reverseKey];
  }
  
  // Try USD as intermediate if possible
  if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
    const toUSD = getHistoricalFXRate(monthKey, fromCurrency, 'USD');
    const fromUSD = getHistoricalFXRate(monthKey, 'USD', toCurrency);
    if (toUSD && fromUSD) {
      return toUSD * fromUSD;
    }
  }
  
  console.warn(`No FX rate found for ${fromCurrency} to ${toCurrency} for ${monthKey}`);
  return 1; // Fallback
}

// Conversion factors
const BUSHEL_TO_KG_WHEAT = 27.2155;
const TONNE_TO_KG = 1000;
const LB_TO_KG = 0.45359237;
const ALUMINUM_CAN_WEIGHT_KG = 0.013;
const BARREL_TO_KG = 136.4;

// NEW: Wheat display unit options
const WHEAT_DISPLAY_OPTIONS = [
  { value: 'usdPerKg', label: 'USD/kg' },
  { value: 'bushel', label: 'USD/bushel' }
];

// Currency configuration for each commodity
const COMMODITY_CURRENCIES = {
  wheat: 'USD',
  milling_wheat: 'USD',
  palm: 'USD', // Converted from MYR to USD
  crude_palm: 'USD',
  sugar: 'NGN',
  aluminum: 'USD'
};

// Units by commodity and currency mode
const getUnitsByCommodity = (commodity, currencyMode, displayUnit = null) => {
  if (commodity === 'wheat' && displayUnit === 'bushel') {
    return 'USD/bushel';
  }
  
  if (commodity === 'palm') {
    return 'USD/tonne';
  }
  
  if (currencyMode === 'original') {
    const currency = COMMODITY_CURRENCIES[commodity];
    if (commodity === 'wheat' || commodity === 'milling_wheat' || 
        commodity === 'crude_palm' || commodity === 'aluminum') {
      return `${currency}/kg`;
    }
    return `${currency}/kg`;
  }
  return 'NGN/kg';
};

const decimalsByCommodity = {
  wheat: { kg: 3, bushel: 2 },
  milling_wheat: 3,
  palm: 2, // USD/tonne
  crude_palm: 3,
  sugar: 2,
  aluminum: 3
};

// Commodity names and colors
const COMMODITY_CONFIG = {
  wheat: { 
    name: 'Wheat CBOT', 
    icon: '🌾', 
    excelColor: '#3B82F6',
    apiColor: '#10B981',
    category: 'Grains',
    showInChart: true
  },
  milling_wheat: { 
    name: 'Milling Wheat', 
    icon: '🌾', 
    excelColor: '#8B5CF6',
    apiColor: '#10B981',
    category: 'Grains',
    showInChart: true
  },
  palm: { 
    name: 'Palm Oil', 
    icon: '🌴', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    category: 'Oils',
    showInChart: true
  },
  crude_palm: { 
    name: 'Crude Palm Oil', 
    icon: '🛢️', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    category: 'Oils',
    showInChart: true
  },
  sugar: { 
    name: 'Sugar', 
    icon: '🍬', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    category: 'Softs',
    showInChart: true
  },
  aluminum: { 
    name: 'Aluminum (Raw Material)',
    icon: '🥫', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    category: 'Metals',
    showInChart: true
  }
};

// Filter commodities that should appear in the chart comparison
const CHART_COMMODITIES = Object.keys(COMMODITY_CONFIG).filter(
  commodity => COMMODITY_CONFIG[commodity].showInChart
);

const DEFAULT_CHART_COMMODITY = CHART_COMMODITIES[0];

// Excel data mapping by commodity
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

// Function to format date for API
function formatDateForAPI(date) {
  return date.toISOString().split('T')[0];
}

// Function to get month key (YYYY-MM)
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
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
        'January': '01', 'February': '02', 'March': '03', 'April': '04',
        'May': '05', 'June': '06', 'July': '07', 'August': '08',
        'September': '09', 'October': '10', 'November': '11', 'December': '12'
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

// Function to get month display name
function getMonthDisplay(monthKey) {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// Function to validate and filter recent data (2020-2025)
function filterRecentData(data, maxYearsBack = 5) {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - maxYearsBack;
  
  return data.filter(item => {
    if (!item.monthKey) return false;
    const year = parseInt(item.monthKey.split('-')[0]);
    return year >= 2020 && year <= currentYear + 1;
  });
}

// Convert API value to target currency - UPDATED with historical FX rates
function convertApiValueToTargetCurrency(commodity, apiValue, targetCurrency, monthKey = null) {
  if (apiValue == null || isNaN(Number(apiValue))) return null;
  const value = Number(apiValue);

  let apiPriceInOriginalCurrency;
  let apiCurrency;

  switch(commodity) {
    case 'wheat':
      // CBOT Wheat: cents per bushel to USD/bushel
      const usdPerBushel = value / 100;
      apiPriceInOriginalCurrency = usdPerBushel;
      apiCurrency = 'USD';
      break;

    case 'milling_wheat':
      // Milling Wheat: EUR per tonne to EUR/kg
      const eurPerTonne = value;
      apiPriceInOriginalCurrency = eurPerTonne / TONNE_TO_KG;
      apiCurrency = 'EUR';
      break;

    case 'palm':
      // Palm Oil (KO*1): MYR per metric ton to USD/tonne
      const myrPerTonne = value;
      apiPriceInOriginalCurrency = myrPerTonne; // Keep in MYR/tonne for conversion
      apiCurrency = 'MYR'; // API provides in MYR
      break;

    case 'crude_palm':
      // Crude Palm Oil: USD per barrel to USD/kg
      apiPriceInOriginalCurrency = value / BARREL_TO_KG;
      apiCurrency = 'USD';
      break;
    
    case 'sugar':
      // Sugar: cents per lb to USD/kg
      const usdPerLb = value / 100;
      apiPriceInOriginalCurrency = usdPerLb / LB_TO_KG;
      apiCurrency = 'USD';
      break;

    case 'aluminum':
      // Aluminum: USD per tonne to USD/kg
      apiPriceInOriginalCurrency = value / TONNE_TO_KG;
      apiCurrency = 'USD';
      break;

    default:
      return value;
  }

  // Convert to target currency if needed
  if (apiCurrency !== targetCurrency) {
    const fxRate = getHistoricalFXRate(monthKey || 'current', apiCurrency, targetCurrency);
    const convertedValue = apiPriceInOriginalCurrency * fxRate;
    
    // For palm oil, ensure it stays in USD/tonne
    if (commodity === 'palm' && targetCurrency === 'USD') {
      return convertedValue; // This is USD/tonne
    }
    
    return convertedValue;
  }

  return apiPriceInOriginalCurrency;
}

// Convert Excel purchase price to target currency - UPDATED for Palm Oil
function convertExcelPriceToTargetCurrency(commodity, excelItem, targetCurrency, monthKey = null) {
  if (!excelItem) return null;
  
  let priceInOriginalCurrency;
  let excelCurrency;
  
  switch(commodity) {
    case 'wheat':
    case 'milling_wheat':
      // Convert all wheat purchases to USD for consistency
      if (excelItem.currency === 'GHS') {
        // Convert GHS to USD using historical rate
        const fxRate = getHistoricalFXRate(monthKey, 'GHS', 'USD');
        priceInOriginalCurrency = excelItem.rate * fxRate;
        excelCurrency = 'USD';
      } else {
        priceInOriginalCurrency = excelItem.rate;
        excelCurrency = excelItem.currency;
      }
      break;
      
    case 'palm':
      // FIX: Excel data has fob in USD/tonne and costPerUnit in USD/kg
      // Use fob field for USD/tonne display
      if (excelItem.fob) {
        priceInOriginalCurrency = excelItem.fob; // Already in USD/tonne
        excelCurrency = 'USD';
      } else {
        priceInOriginalCurrency = excelItem.rate;
        excelCurrency = 'GHS';
      }
      break;
      
    case 'crude_palm':
      priceInOriginalCurrency = excelItem.rate;
      excelCurrency = excelItem.currency || 'USD';
      break;
      
    case 'sugar':
      priceInOriginalCurrency = excelItem.cost;
      excelCurrency = 'NGN';
      break;
      
    case 'aluminum':
      priceInOriginalCurrency = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE / TONNE_TO_KG;
      excelCurrency = 'USD';
      break;
      
    default:
      return null;
  }

  // Convert to target currency if needed
  if (excelCurrency !== targetCurrency) {
    const fxRate = getHistoricalFXRate(monthKey, excelCurrency, targetCurrency);
    return priceInOriginalCurrency * fxRate;
  }

  return priceInOriginalCurrency;
}

// Get Excel date for month grouping
function getExcelDateForMonth(commodity, excelItem) {
  switch(commodity) {
    case 'wheat':
    case 'milling_wheat':
    case 'palm':
    case 'crude_palm':
      return excelItem.poDate;
    case 'sugar':
    case 'aluminum':
      return excelItem.month;
    default:
      return null;
  }
}

// Process Excel data by month (average per month) - Updated with historical FX
function processExcelDataByMonth(commodity, currencyMode) {
  const rawData = EXCEL_DATA_SOURCES[commodity] || [];
  
  console.log(`Processing ${commodity} data in ${currencyMode} mode:`, {
    rawDataLength: rawData.length
  });
  
  const targetCurrency = currencyMode === 'original' 
    ? COMMODITY_CURRENCIES[commodity] 
    : 'NGN';
  
  const monthlyData = {};
  
  rawData.forEach((item, index) => {
    const dateStr = getExcelDateForMonth(commodity, item);
    const monthKey = getMonthKey(dateStr);
    
    if (!monthKey) {
      console.warn(`Could not parse date for ${commodity} item ${index}:`, dateStr);
      return;
    }
    
    const year = parseInt(monthKey.split('-')[0]);
    const currentYear = new Date().getFullYear();
    
    if (year < 2020 || year > currentYear + 1) {
      console.warn(`Skipping unrealistic year for ${commodity}:`, monthKey, 'from date:', dateStr);
      return;
    }
    
    const priceInTargetCurrency = convertExcelPriceToTargetCurrency(commodity, item, targetCurrency, monthKey);
    if (priceInTargetCurrency == null) return;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        monthKey,
        values: [],
        dates: [],
        currencies: []
      };
    }
    
    monthlyData[monthKey].values.push(priceInTargetCurrency);
    monthlyData[monthKey].dates.push(dateStr);
    monthlyData[monthKey].currencies.push(item.currency || COMMODITY_CURRENCIES[commodity]);
  });
  
  const result = Object.values(monthlyData).map(month => ({
    monthKey: month.monthKey,
    monthDisplay: getMonthDisplay(month.monthKey),
    excelPrice: month.values.reduce((sum, val) => sum + val, 0) / month.values.length,
    transactionCount: month.values.length,
    dates: month.dates,
    currencies: month.currencies
  })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  
  const filteredResult = filterRecentData(result, 5);
  
  console.log(`${commodity} processed data in ${currencyMode}:`, {
    totalMonths: result.length,
    filteredMonths: filteredResult.length,
    targetCurrency
  });
  
  return filteredResult;
}

// Fetch monthly prices with better variation detection
async function fetchMonthlyPricesWithVariation(symbol, months) {
  try {
    const monthlyResults = [];
    
    const recentMonths = months.filter(monthKey => {
      const year = parseInt(monthKey.split('-')[0]);
      return year >= 2020;
    });
    
    if (recentMonths.length === 0) {
      console.warn(`No recent months to fetch for ${symbol}`);
      return [];
    }
    
    console.log(`Fetching REAL API data for ${symbol}, months:`, recentMonths);
    
    for (const month of recentMonths) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      const startStr = formatDateForAPI(startDate);
      const endStr = formatDateForAPI(endDate);
      
      const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${startStr}&enddate=${endStr}`;
      
      try {
        console.log(`API Request for ${month}: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn(`Failed to fetch ${month} for ${symbol}: HTTP ${response.status}`);
          continue;
        }
        
        const text = await response.text();
        
        if (!text || text.includes('error') || text.includes('No data')) {
          console.warn(`No data for ${month} - ${symbol}`);
          continue;
        }
        
        const lines = text.trim().split('\n').filter(line => line.trim() && !line.includes('error'));
        
        const dailyPrices = [];
        console.log(`Raw CSV lines for ${month}:`, lines.length);
        
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
          const sum = dailyPrices.reduce((sum, day) => sum + day.price, 0);
          const monthlyAvg = sum / dailyPrices.length;
          
          monthlyResults.push({
            monthKey: month,
            avgPrice: monthlyAvg,
            dataPoints: dailyPrices.length,
            sampleDates: dailyPrices.slice(0, 3).map(d => d.date)
          });
          
          console.log(`✅ ${month} for ${symbol}: ${dailyPrices.length} trading days, avg: ${monthlyAvg.toFixed(2)}`);
        } else {
          console.warn(`No valid daily prices for ${month} - ${symbol}`);
        }
        
      } catch (fetchError) {
        console.error(`Error fetching ${month} for ${symbol}:`, fetchError);
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    return monthlyResults;
    
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return [];
  }
}

// Process API data by month - Updated with historical FX
function processApiDataByMonth(commodity, apiMonthlyData, currencyMode, wheatDisplayUnit = 'usdPerKg') {
  const targetCurrency = currencyMode === 'original' 
    ? COMMODITY_CURRENCIES[commodity] 
    : 'NGN';
  
  return apiMonthlyData.map(item => {
    let apiPrice = convertApiValueToTargetCurrency(commodity, item.avgPrice, targetCurrency, item.monthKey);
    
    // Convert wheat from bushel to kg if needed
    if (commodity === 'wheat') {
      if (wheatDisplayUnit === 'bushel') {
        // Keep in USD/bushel (apiPrice is already in USD/bushel after conversion)
        // No conversion needed
      } else {
        // Convert from USD/bushel to USD/kg
        apiPrice = apiPrice / BUSHEL_TO_KG_WHEAT;
      }
    }
    
    // For palm oil, ensure we're in USD/tonne
    if (commodity === 'palm' && targetCurrency === 'USD') {
      // apiPrice is already in USD/tonne
    }
    
    return {
      monthKey: item.monthKey,
      monthDisplay: getMonthDisplay(item.monthKey),
      apiPrice: apiPrice,
      dataPoints: item.dataPoints,
      source: item.source || 'api'
    };
  }).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

// Combine Excel and API data by month
function combineMonthlyData(excelMonthly, apiMonthly, commodity, wheatDisplayUnit = 'usdPerKg') {
  const excelMonths = excelMonthly.map(item => item.monthKey);
  
  return excelMonths.map(monthKey => {
    const excelMonth = excelMonthly.find(item => item.monthKey === monthKey);
    const apiMonth = apiMonthly.find(item => item.monthKey === monthKey);
    
    let excelPrice = excelMonth?.excelPrice || null;
    let apiPrice = apiMonth?.apiPrice || null;
    
    // Adjust wheat prices based on display unit
    if (commodity === 'wheat') {
      if (excelPrice && wheatDisplayUnit === 'bushel') {
        // Convert Excel price from USD/kg to USD/bushel
        excelPrice = excelPrice * BUSHEL_TO_KG_WHEAT;
      }
    }
    
    // Adjust palm oil to USD/tonne
    if (commodity === 'palm') {
      // excelPrice should already be in USD/tonne
      // apiPrice should already be in USD/tonne
    }
    
    return {
      monthKey,
      monthDisplay: getMonthDisplay(monthKey),
      excelPrice: excelPrice,
      apiPrice: apiPrice,
      excelTransactions: excelMonth?.transactionCount || 0,
      apiDataPoints: apiMonth?.dataPoints || 0,
      apiSource: apiMonth?.source || 'none'
    };
  });
}

const CommodityDashboard = () => {
  // Currency mode state
  const [currencyMode, setCurrencyMode] = useState('original'); // 'original' or 'ngn'
  const [selectedCommodity, setSelectedCommodity] = useState(DEFAULT_CHART_COMMODITY);
  const [wheatDisplayUnit, setWheatDisplayUnit] = useState('usdPerKg'); // 'usdPerKg' or 'bushel'
  const [commodityData, setCommodityData] = useState({});
  const [monthlyComparisonData, setMonthlyComparisonData] = useState({});
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingLivePrices, setLoadingLivePrices] = useState(false);
  const [error, setError] = useState('');
  const [dataDebug, setDataDebug] = useState('');
  const [apiStatus, setApiStatus] = useState('connecting');

  // Process Excel data by month - Updated with historical FX
  const excelMonthlyData = useMemo(() => {
    console.log(`Processing Excel data for all commodities in ${currencyMode} mode...`);
    const data = {};
    Object.keys(COMMODITY_CONFIG).forEach(commodity => {
      data[commodity] = processExcelDataByMonth(commodity, currencyMode);
    });
    
    // Handle aluminum data
    if (!data.aluminum || data.aluminum.length === 0) {
      const months = [];
      const currentDate = new Date();
      const startDate = new Date(2020, 0, 1);
      
      const targetCurrency = currencyMode === 'original' ? 'USD' : 'NGN';
      const baseUsdPerKg = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE / TONNE_TO_KG;
      
      for (let d = new Date(startDate); d <= currentDate; d.setMonth(d.getMonth() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        
        let price;
        if (targetCurrency === 'USD') {
          price = baseUsdPerKg;
        } else {
          const fxRate = getHistoricalFXRate(monthKey, 'USD', 'NGN');
          price = baseUsdPerKg * fxRate;
        }
        
        months.push({
          monthKey,
          monthDisplay: getMonthDisplay(monthKey),
          excelPrice: price,
          transactionCount: 1,
          dates: [monthKey],
          currencies: ['USD']
        });
      }
      
      data.aluminum = months;
      console.log(`Generated aluminum data in ${currencyMode} mode:`, months.length, 'months');
    }
    
    return data;
  }, [currencyMode]);

  // Fetch live prices for all commodities - Updated with historical FX
  useEffect(() => {
    const fetchLivePrices = async () => {
      setLoadingLivePrices(true);
      setApiStatus('fetching_live');
      
      try {
        const liveData = {};
        
        for (const [commodity, symbol] of Object.entries(COMMODITY_SYMBOLS)) {
          console.log(`Fetching live price with history for ${commodity} (${symbol})...`);
          
          const priceData = await fetchCurrentPriceWithHistory(symbol);
          
          if (!priceData) {
            console.warn(`No live price data for ${commodity}`);
            liveData[commodity] = {
              current: null,
              previous: null,
              weekAgo: null,
              monthAgo: null,
              yearAgo: null,
              percentages: { day: null, week: null, month: null, year: null },
              symbol,
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              status: 'no_data'
            };
            continue;
          }
          
          const targetCurrency = currencyMode === 'original' 
            ? COMMODITY_CURRENCIES[commodity] 
            : 'NGN';
          
          // Get current month key for FX rate
          const currentDate = new Date();
          const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          
          const current = convertApiValueToTargetCurrency(commodity, priceData.current, targetCurrency, currentMonthKey);
          const previous = priceData.previous ? convertApiValueToTargetCurrency(commodity, priceData.previous, targetCurrency, currentMonthKey) : null;
          
          // For historical prices, use appropriate month keys
          let weekAgo = null, monthAgo = null, yearAgo = null;
          
          if (priceData.weekAgo && priceData.weekAgoDate) {
            const weekMonthKey = getMonthKey(priceData.weekAgoDate);
            weekAgo = convertApiValueToTargetCurrency(commodity, priceData.weekAgo, targetCurrency, weekMonthKey);
          }
          
          if (priceData.monthAgo && priceData.monthAgoDate) {
            const monthMonthKey = getMonthKey(priceData.monthAgoDate);
            monthAgo = convertApiValueToTargetCurrency(commodity, priceData.monthAgo, targetCurrency, monthMonthKey);
          }
          
          if (priceData.yearAgo && priceData.yearAgoDate) {
            const yearMonthKey = getMonthKey(priceData.yearAgoDate);
            yearAgo = convertApiValueToTargetCurrency(commodity, priceData.yearAgo, targetCurrency, yearMonthKey);
          }
          
          // Adjust wheat display unit
          let displayCurrent = current;
          if (commodity === 'wheat' && wheatDisplayUnit === 'bushel' && current) {
            displayCurrent = current; // Already in USD/bushel
          } else if (commodity === 'wheat' && wheatDisplayUnit === 'usdPerKg' && current) {
            displayCurrent = current / BUSHEL_TO_KG_WHEAT;
          }
          
          const percentages = {
            day: previous ? calculatePercentageChange(displayCurrent, previous) : null,
            week: weekAgo ? calculatePercentageChange(displayCurrent, weekAgo) : null,
            month: monthAgo ? calculatePercentageChange(displayCurrent, monthAgo) : null,
            year: yearAgo ? calculatePercentageChange(displayCurrent, yearAgo) : null
          };
          
          liveData[commodity] = {
            current: displayCurrent,
            previous,
            weekAgo,
            monthAgo,
            yearAgo,
            percentages,
            symbol,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'success',
            rawData: {
              currentUSD: priceData.current,
              previousUSD: priceData.previous,
              weekAgoUSD: priceData.weekAgo,
              monthAgoUSD: priceData.monthAgo,
              yearAgoUSD: priceData.yearAgo
            }
          };
          
          console.log(`Live price for ${commodity} in ${targetCurrency}:`, {
            current: displayCurrent,
            percentages
          });
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        setLivePrices(liveData);
        setApiStatus('connected');
        
      } catch (error) {
        console.error('Error fetching live prices:', error);
        setApiStatus('error');
        
        const emptyLiveData = {};
        Object.keys(COMMODITY_SYMBOLS).forEach(commodity => {
          emptyLiveData[commodity] = {
            current: null,
            previous: null,
            weekAgo: null,
            monthAgo: null,
            yearAgo: null,
            percentages: { day: null, week: null, month: null, year: null },
            symbol: COMMODITY_SYMBOLS[commodity],
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'error'
          };
        });
        
        setLivePrices(emptyLiveData);
      } finally {
        setLoadingLivePrices(false);
      }
    };

    fetchLivePrices();
    
    const intervalId = setInterval(fetchLivePrices, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [currencyMode, wheatDisplayUnit]);

  // Fetch API data and combine with Excel data - Updated with wheat display unit
  useEffect(() => {
    const fetchAllCommodityData = async () => {
      setLoading(true);
      setError('');
      setApiStatus('fetching_historical');
      
      try {
        const dataPromises = Object.entries(COMMODITY_SYMBOLS).map(async ([commodity, symbol]) => {
          const excelMonthly = excelMonthlyData[commodity] || [];
          
          console.log(`Fetching historical data for ${commodity}:`, {
            excelMonths: excelMonthly.length,
            monthKeys: excelMonthly.map(m => m.monthKey)
          });
          
          if (excelMonthly.length === 0) {
            console.warn(`No Excel data for ${commodity}`);
            return {
              commodity,
              symbol,
              monthlyComparisonData: [],
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
          }
          
          const excelMonths = excelMonthly.map(item => item.monthKey);
          const apiMonthlyRaw = await fetchMonthlyPricesWithVariation(symbol, excelMonths);
          
          const apiMonthly = processApiDataByMonth(commodity, apiMonthlyRaw, currencyMode, wheatDisplayUnit);
          const combinedData = combineMonthlyData(excelMonthly, apiMonthly, commodity, wheatDisplayUnit);
          
          const apiPrices = combinedData.filter(d => d.apiPrice).map(d => d.apiPrice);
          const uniquePrices = [...new Set(apiPrices.map(p => p?.toFixed(2)))];
          const hasVariation = uniquePrices.length > 1;
          
          return {
            commodity,
            symbol,
            monthlyComparisonData: combinedData,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            hasVariation
          };
        });

        const results = await Promise.all(dataPromises);
        
        const dataObj = {};
        const comparisonObj = {};
        
        results.forEach(result => {
          dataObj[result.commodity] = result;
          comparisonObj[result.commodity] = result.monthlyComparisonData;
        });
        
        setCommodityData(dataObj);
        setMonthlyComparisonData(comparisonObj);
        
        const apiDataSummary = Object.keys(comparisonObj).map(commodity => {
          const data = comparisonObj[commodity];
          const apiMonths = data.filter(d => d.apiPrice != null).length;
          const totalMonths = data.length;
          const apiPrices = data.filter(d => d.apiPrice).map(d => d.apiPrice);
          const uniquePrices = [...new Set(apiPrices.map(p => p?.toFixed(2)))];
          const hasVariation = uniquePrices.length > 1;
          
          return `${commodity}: ${apiMonths}/${totalMonths} ${hasVariation ? '✓' : '⚠️'}`;
        }).join(' | ');
        
        setDataDebug(`API Data: ${apiDataSummary} | Currency Mode: ${currencyMode.toUpperCase()} | Wheat Unit: ${wheatDisplayUnit}`);
        setApiStatus('connected');
        
      } catch (err) {
        console.error('Error in fetchAllCommodityData:', err);
        setError(`Failed to fetch data: ${err.message}. Please check your API connection.`);
        setApiStatus('error');
        
        const emptyData = {};
        const emptyComparison = {};
        
        Object.keys(COMMODITY_CONFIG).forEach(commodity => {
          const excelMonthly = excelMonthlyData[commodity] || [];
          const combinedData = excelMonthly.map(item => ({
            monthKey: item.monthKey,
            monthDisplay: item.monthDisplay,
            excelPrice: item.excelPrice,
            apiPrice: null,
            excelTransactions: item.transactionCount,
            apiDataPoints: 0
          }));
          
          emptyData[commodity] = {
            commodity,
            symbol: COMMODITY_SYMBOLS[commodity],
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          
          emptyComparison[commodity] = combinedData;
        });
        
        setCommodityData(emptyData);
        setMonthlyComparisonData(emptyComparison);
      } finally {
        setLoading(false);
      }
    };

    fetchAllCommodityData();
    
    const intervalId = setInterval(fetchAllCommodityData, 10 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [excelMonthlyData, currencyMode, wheatDisplayUnit]);

  // Helper functions
  async function fetchCurrentPriceWithHistory(symbol) {
    try {
      const dailyData = await fetchDailyPrices(symbol, 365);
      
      if (dailyData.length === 0) {
        console.warn(`No daily data for ${symbol}`);
        return null;
      }
      
      const latest = dailyData[dailyData.length - 1];
      const weekAgoIndex = Math.max(0, dailyData.length - 8);
      const weekAgo = dailyData[weekAgoIndex];
      const monthAgoIndex = Math.max(0, dailyData.length - 31);
      const monthAgo = dailyData[monthAgoIndex];
      const yearAgoIndex = Math.max(0, dailyData.length - 366);
      const yearAgo = dailyData[yearAgoIndex];
      
      return {
        current: latest.price,
        previous: dailyData.length >= 2 ? dailyData[dailyData.length - 2].price : null,
        weekAgo: weekAgo?.price || null,
        monthAgo: monthAgo?.price || null,
        yearAgo: yearAgo?.price || null,
        date: latest.date,
        weekAgoDate: weekAgo?.date || null,
        monthAgoDate: monthAgo?.date || null,
        yearAgoDate: yearAgo?.date || null
      };
      
    } catch (error) {
      console.error(`Error fetching current price with history for ${symbol}:`, error);
      return null;
    }
  }

  async function fetchDailyPrices(symbol, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      
      const startStr = formatDateForAPI(startDate);
      const endStr = formatDateForAPI(endDate);
      
      const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${startStr}&enddate=${endStr}`;
      
      console.log(`Fetching daily prices for ${symbol}: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const text = await response.text();
      
      if (!text || text.includes('error') || text.includes('No data')) {
        return [];
      }
      
      const lines = text.trim().split('\n').filter(line => line.trim() && !line.includes('error'));
      
      const dailyData = [];
      lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 6) {
          const symbol = parts[0];
          const date = parts[1];
          const closePrice = parseFloat(parts[5]);
          const volume = parts.length > 6 ? parseInt(parts[6]) : 0;
          
          if (!isNaN(closePrice) && closePrice > 0) {
            dailyData.push({
              date,
              price: closePrice,
              volume: volume || 0,
              symbol: symbol
            });
          }
        }
      });
      
      console.log(`Fetched ${dailyData.length} daily prices for ${symbol}`);
      return dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
      
    } catch (error) {
      console.error(`Error fetching daily prices for ${symbol}:`, error);
      return [];
    }
  }

  function calculatePercentageChange(current, previous) {
    if (!previous || previous === 0 || !current) return null;
    return ((current - previous) / previous) * 100;
  }

  // Prepare chart data for selected commodity
  const prepareChartData = () => {
    const data = monthlyComparisonData[selectedCommodity] || [];
    const filteredData = data.filter(item => item.excelPrice != null);
    
    return filteredData.map(item => ({
      month: item.monthDisplay,
      monthKey: item.monthKey,
      excelPrice: item.excelPrice,
      apiPrice: item.apiPrice,
      excelTransactions: item.excelTransactions,
      apiDataPoints: item.apiDataPoints,
      apiSource: item.apiSource
    }));
  };

  // Custom tooltip for chart - Updated for units
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    const config = COMMODITY_CONFIG[selectedCommodity];
    
    let dec = decimalsByCommodity[selectedCommodity];
    if (selectedCommodity === 'wheat') {
      dec = wheatDisplayUnit === 'bushel' ? dec.bushel : dec.kg;
    } else if (typeof dec === 'object') {
      dec = 2;
    }
    
    const targetCurrency = currencyMode === 'original' 
      ? COMMODITY_CURRENCIES[selectedCommodity] 
      : 'NGN';
    
    const units = getUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit);

    return (
      <div style={{
        background: 'white',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ccc',
        minWidth: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <p style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>
          {data.month}
        </p>
        
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: '12px', height: '3px', backgroundColor: config.excelColor, borderRadius: '1px' }}></div>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Our Purchase (Excel)</span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: 'bold', color: config.excelColor, fontSize: '16px' }}>
              {data.excelPrice.toFixed(dec)} {units}
            </span>
            {selectedCommodity === 'aluminum' ? (
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                Negotiated: {NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE} USD/tonne
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {data.excelTransactions} transaction{data.excelTransactions !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        
        {data.apiPrice && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ width: '12px', height: '3px', backgroundColor: config.apiColor, borderRadius: '1px' }}></div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Market Price (API)</span>
              {data.apiSource === 'real_variation' && (
                <span style={{
                  fontSize: '10px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '1px 4px',
                  borderRadius: '3px'
                }}>
                  Adjusted
                </span>
              )}
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 'bold', color: config.apiColor, fontSize: '16px' }}>
                {data.apiPrice.toFixed(dec)} {units}
              </span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {data.apiDataPoints} trading day{data.apiDataPoints !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
        
        {!data.apiPrice && (
          <div style={{ 
            marginTop: '8px',
            padding: '8px',
            backgroundColor: '#fef3c7',
            borderRadius: '6px',
            border: '1px solid #fbbf24'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>⚠️</span>
              <span style={{ fontSize: '11px', color: '#92400e' }}>
                No market data available for this month
              </span>
            </div>
          </div>
        )}
        
        {data.apiPrice && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px',
            backgroundColor: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Difference:</span>
              <span style={{ 
                fontWeight: 'bold',
                fontSize: '14px',
                color: data.excelPrice <= data.apiPrice ? '#059669' : '#dc2626'
              }}>
                {data.excelPrice <= data.apiPrice ? '▼ Cheaper' : '▲ Premium'} 
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Amount:</span>
              <span style={{ 
                fontWeight: '600',
                fontSize: '13px',
                color: data.excelPrice <= data.apiPrice ? '#059669' : '#dc2626'
              }}>
                {Math.abs(data.excelPrice - data.apiPrice).toFixed(dec)} {units}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ marginBottom: '16px' }}>Loading monthly commodity dashboard...</div>
        <div style={{ color: '#666', fontSize: '14px' }}>Processing Excel data and fetching REAL market prices from API...</div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 600, color: '#1e40af' }}>
              📈 Monthly Commodity Price Comparison
            </h2>
            <div style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
              Monthly Averages: Our Purchases vs Market Prices | 
              Currency Mode: {currencyMode === 'original' ? 'Document Currency' : 'NGN'} |
              {selectedCommodity === 'wheat' && ` Wheat Unit: ${wheatDisplayUnit === 'bushel' ? 'USD/bushel' : 'USD/kg'}`}
            </div>
          </div>
          
          {/* Currency Toggle Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#d1fae5',
              borderRadius: '8px',
              border: '2px solid #10b981',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🌐 Real API Data Only
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              padding: '4px',
              border: '2px solid #e5e7eb'
            }}>
              <button
                onClick={() => setCurrencyMode('original')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: currencyMode === 'original' ? '#3B82F6' : 'transparent',
                  color: currencyMode === 'original' ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>💰</span>
                <span>Document Currency</span>
              </button>
              
              <button
                onClick={() => setCurrencyMode('ngn')}
                style={{
                  padding: '8px 16px',
                  backgroundColor: currencyMode === 'ngn' ? '#10B981' : 'transparent',
                  color: currencyMode === 'ngn' ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🇳🇬</span>
                <span>NGN</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* NEW: Wheat Display Unit Selector (only shown when wheat is selected) */}
        {selectedCommodity === 'wheat' && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            border: '2px solid #bae6fd',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '16px', fontWeight: '600', color: '#0369a1' }}>
              Wheat Display Unit:
            </span>
            <select
              value={wheatDisplayUnit}
              onChange={(e) => setWheatDisplayUnit(e.target.value)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                border: '2px solid #3B82F6',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#1e40af',
                cursor: 'pointer',
                minWidth: '140px'
              }}
            >
              {WHEAT_DISPLAY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>
              API returns in cents/bushel • 1 bushel = {BUSHEL_TO_KG_WHEAT.toFixed(2)} kg wheat
            </div>
          </div>
        )}
        
        {/* Currency Mode Info */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: currencyMode === 'original' ? '#dbeafe' : '#d1fae5',
          borderRadius: '8px',
          border: `2px solid ${currencyMode === 'original' ? '#3B82F6' : '#10B981'}`,
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>
              {currencyMode === 'original' ? '💰' : '🇳🇬'}
            </span>
            <div>
              <span style={{ 
                fontWeight: '600', 
                color: currencyMode === 'original' ? '#1e40af' : '#065f46',
                fontSize: '14px'
              }}>
                {currencyMode === 'original' 
                  ? 'DOCUMENT CURRENCY MODE: Showing prices in original purchase currency' 
                  : 'NGN MODE: All prices converted to Nigerian Naira'}
              </span>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {currencyMode === 'original' 
                  ? `• Wheat: ${wheatDisplayUnit === 'bushel' ? 'USD/bushel' : 'USD/kg'} • Milling Wheat: USD/kg • Palm Oil: USD/tonne • Crude Palm Oil: USD/kg • Sugar: NGN/kg • Aluminum: USD/kg`
                  : '• All commodities: NGN/kg • Using historical monthly FX rates'}
              </div>
            </div>
          </div>
        </div>
        
        {/* API Status Banner */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: apiStatus === 'connected' ? '#d1fae5' : 
                          apiStatus === 'error' ? '#fee2e2' : '#fef3c7',
          borderRadius: '8px',
          border: `2px solid ${apiStatus === 'connected' ? '#10b981' : 
                             apiStatus === 'error' ? '#dc2626' : '#fbbf24'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>
              {apiStatus === 'connected' ? '✅' : apiStatus === 'error' ? '⚠️' : '🔄'}
            </span>
            <span style={{ 
              fontWeight: '600', 
              color: apiStatus === 'connected' ? '#065f46' : 
                     apiStatus === 'error' ? '#dc2626' : '#92400e',
              fontSize: '14px'
            }}>
              {apiStatus === 'connected' ? 'LIVE MODE: Connected to DDFPlus API' :
               apiStatus === 'error' ? 'API ERROR: Failed to fetch market data' :
               'CONNECTING: Fetching real-time market data...'}
            </span>
          </div>
          
          <div style={{
            fontSize: '11px',
            color: apiStatus === 'connected' ? '#059669' : 
                   apiStatus === 'error' ? '#dc2626' : '#d97706',
            fontWeight: '600'
          }}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Debug info */}
      <div style={{
        marginBottom: '16px',
        padding: '8px 12px',
        backgroundColor: '#f0f9ff',
        borderRadius: '6px',
        border: '1px solid #bae6fd',
        fontSize: '11px',
        color: '#0369a1',
        fontFamily: 'monospace'
      }}>
        <strong>API Status:</strong> {dataDebug || 'Loading...'} | <strong>Mode:</strong> Real API Only | 
        <strong> Currency:</strong> {currencyMode.toUpperCase()} | <strong>Current USD/NGN:</strong> 1460
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: '#fee2e2',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Commodity Selector */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '32px',
        flexWrap: 'wrap'
      }}>
        {CHART_COMMODITIES.map(commodity => {
          const config = COMMODITY_CONFIG[commodity];
          const isSelected = selectedCommodity === commodity;
          const comparisonData = monthlyComparisonData[commodity] || [];
          const monthsWithExcelData = comparisonData.filter(item => item.excelPrice != null).length;
          const monthsWithApiData = comparisonData.filter(item => item.apiPrice != null).length;
          const apiCoverage = monthsWithExcelData > 0 ? Math.round((monthsWithApiData / monthsWithExcelData) * 100) : 0;
          const apiPrices = comparisonData.filter(item => item.apiPrice).map(item => item.apiPrice);
          const uniquePrices = [...new Set(apiPrices.map(p => p?.toFixed(2)))];
          const hasVariation = uniquePrices.length > 1;
          const targetCurrency = currencyMode === 'original' 
            ? COMMODITY_CURRENCIES[commodity] 
            : 'NGN';
          const units = getUnitsByCommodity(commodity, currencyMode, commodity === 'wheat' ? wheatDisplayUnit : null);
          
          return (
            <button
              key={commodity}
              onClick={() => setSelectedCommodity(commodity)}
              style={{
                padding: '12px 20px',
                backgroundColor: isSelected ? '#1e40af' : '#f3f4f6',
                color: isSelected ? 'white' : '#374151',
                border: `2px solid ${isSelected ? '#1e40af' : '#e5e7eb'}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '180px',
                position: 'relative'
              }}
            >
              <span style={{ fontSize: '18px' }}>{config.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div>{config.name}</div>
                <div style={{ fontSize: '10px', color: isSelected ? '#bfdbfe' : '#6b7280' }}>
                  {units}
                </div>
              </div>
              {monthsWithExcelData > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  gap: '4px',
                  flexDirection: 'column',
                  alignItems: 'flex-end'
                }}>
                  <span style={{
                    display: 'flex',
                    gap: '2px'
                  }}>
                    <span style={{
                      fontSize: '8px',
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      padding: '1px 3px',
                      borderRadius: '2px'
                    }}>
                      {monthsWithExcelData}
                    </span>
                    <span style={{
                      fontSize: '8px',
                      backgroundColor: monthsWithApiData > 0 ? 
                        (hasVariation ? '#10B981' : '#f59e0b') : '#9ca3af',
                      color: 'white',
                      padding: '1px 3px',
                      borderRadius: '2px'
                    }}>
                      {monthsWithApiData}
                    </span>
                  </span>
                  <span style={{
                    fontSize: '8px',
                    color: apiCoverage >= 80 ? '#059669' : apiCoverage >= 50 ? '#d97706' : '#dc2626',
                    fontWeight: 'bold'
                  }}>
                    {apiCoverage}% API {hasVariation ? '' : '⚠️'}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Dashboard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '32px',
        marginBottom: '32px'
      }}>
        {/* Left Column: Data Status */}
        <div>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#374151' }}>
            Data Status
          </h3>
          
          {/* Commodity Status Cards */}
          <div style={{
            display: 'grid',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {CHART_COMMODITIES.map(commodity => {
              const config = COMMODITY_CONFIG[commodity];
              const data = commodityData[commodity];
              const comparisonData = monthlyComparisonData[commodity] || [];
              const excelMonths = comparisonData.filter(item => item.excelPrice != null);
              const apiMonths = comparisonData.filter(item => item.apiPrice != null);
              const hasExcelData = excelMonths.length > 0;
              const hasApiData = apiMonths.length > 0;
              const apiCoverage = hasExcelData ? Math.round((apiMonths.length / excelMonths.length) * 100) : 0;
              const apiPrices = apiMonths.map(item => item.apiPrice);
              const uniquePrices = [...new Set(apiPrices.map(p => p?.toFixed(2)))];
              const hasVariation = uniquePrices.length > 1;
              const targetCurrency = currencyMode === 'original' 
                ? COMMODITY_CURRENCIES[commodity] 
                : 'NGN';
              const units = getUnitsByCommodity(commodity, currencyMode, commodity === 'wheat' ? wheatDisplayUnit : null);
              
              return (
                <div 
                  key={commodity}
                  style={{
                    padding: '16px',
                    backgroundColor: commodity === selectedCommodity ? '#eff6ff' : 'white',
                    borderRadius: '12px',
                    border: `2px solid ${commodity === selectedCommodity ? '#3B82F6' : '#e5e7eb'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setSelectedCommodity(commodity)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{config.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>{config.name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{units}</div>
                      </div>
                    </div>
                    {commodity === selectedCommodity && (
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: '#3B82F6',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        SELECTED
                      </span>
                    )}
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    fontSize: '12px'
                  }}>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '2px' }}>Our Data</div>
                      <div style={{ 
                        fontWeight: '600', 
                        color: hasExcelData ? '#3B82F6' : '#9ca3af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{hasExcelData ? '✓' : '✗'}</span>
                        <span>{excelMonths.length} months</span>
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '2px' }}>Market Data</div>
                      <div style={{ 
                        fontWeight: '600', 
                        color: hasApiData ? 
                          (hasVariation ? '#10B981' : '#f59e0b') : '#9ca3af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{hasApiData ? (hasVariation ? '✓' : '⚠️') : '✗'}</span>
                        <span>{apiMonths.length} months</span>
                      </div>
                    </div>
                  </div>
                  
                  {hasExcelData && (
                    <div style={{ 
                      marginTop: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid #e5e7eb'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>API Coverage:</span>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 'bold',
                          color: apiCoverage >= 80 ? '#059669' : apiCoverage >= 50 ? '#d97706' : '#dc2626'
                        }}>
                          {apiCoverage}%
                        </span>
                      </div>
                      <div style={{ 
                        height: '4px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginBottom: '4px'
                      }}>
                        <div 
                          style={{
                            height: '100%',
                            width: `${apiCoverage}%`,
                            backgroundColor: apiCoverage >= 80 ? '#10B981' : apiCoverage >= 50 ? '#f59e0b' : '#ef4444',
                            borderRadius: '2px'
                          }}
                        />
                      </div>
                      {hasApiData && !hasVariation && (
                        <div style={{ 
                          fontSize: '10px',
                          color: '#92400e',
                          backgroundColor: '#fef3c7',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          textAlign: 'center',
                          marginTop: '4px'
                        }}>
                          ⚠️ Constant API prices 
                        </div>
                      )}
                    </div>
                  )}
                  
                  {commodity === 'palm' && (
                    <div style={{ 
                      marginTop: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid #e5e7eb',
                      fontSize: '11px',
                      color: '#6b7280'
                    }}>
                      <div>API: KO*1 (MYR/tonne) → Converted to USD/tonne</div>
                      <div>Excel: FOB in USD/tonne</div>
                    </div>
                  )}
                  
                  {commodity === 'wheat' && (
                    <div style={{ 
                      marginTop: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid #e5e7eb',
                      fontSize: '11px',
                      color: '#6b7280'
                    }}>
                      <div>API: ZW*1 (cents/bushel) → {wheatDisplayUnit === 'bushel' ? 'USD/bushel' : 'USD/kg'}</div>
                      <div>Current unit: {wheatDisplayUnit === 'bushel' ? 'USD/bushel' : 'USD/kg'}</div>
                    </div>
                  )}
                  
                  {hasExcelData && commodity === 'aluminum' && (
                    <div style={{ 
                      marginTop: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid #e5e7eb',
                      fontSize: '11px',
                      color: '#6b7280'
                    }}>
                      <div>Negotiated: {NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE} USD/tonne</div>
                      <div>~{(NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE / TONNE_TO_KG).toFixed(2)} USD/kg</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Data Processing Info */}
          <div style={{
            padding: '20px',
            backgroundColor: '#f0f9ff',
            borderRadius: '12px',
            border: '2px solid #bae6fd'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>📊</span>
              <span style={{ fontWeight: 600, fontSize: '16px', color: '#0369a1' }}>Details</span>
            </div>
            <div style={{
              display: 'grid',
              gap: '12px',
              fontSize: '13px'
            }}>
              <div>
                <div style={{ color: '#3B82F6', fontWeight: 600, marginBottom: '4px' }}>Blue Line (Our Price)</div>
                <div style={{ color: '#374151' }}>
                  {selectedCommodity === 'aluminum' 
                    ? 'Negotiated raw material price: 2400 USD/tonne' 
                    : 'Excel Purchase Price'}
                </div>
              </div>
              <div>
                <div style={{ color: '#10B981', fontWeight: 600, marginBottom: '4px' }}>Green Line (Market Price)</div>
                <div style={{ color: '#374151' }}>
                  DDFPlus API prices converted to {currencyMode === 'original' ? 'document currency' : 'NGN'}
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    {selectedCommodity === 'wheat' ? 'ZW*1: CBOT Wheat Futures (cents/bushel)' : 
                     selectedCommodity === 'milling_wheat' ? 'ML*1: Milling Wheat Futures' : 
                     selectedCommodity === 'palm' ? 'KO*1: Palm Oil Futures (MYR/tonne)' :
                     'Real-time commodity data'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>
              Currency Mode: {currencyMode === 'original' 
                ? 'Showing in original purchase currency for each commodity' 
                : 'All prices converted to NGN using historical monthly FX rates'}
            </div>
            {selectedCommodity === 'wheat' && (
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                Wheat Unit: {wheatDisplayUnit === 'bushel' ? 'USD/bushel' : 'USD/kg'} (1 bushel = {BUSHEL_TO_KG_WHEAT.toFixed(2)} kg)
              </div>
            )}
            {selectedCommodity === 'palm' && (
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                Palm Oil: Converted from MYR/tonne to USD/tonne
              </div>
            )}
          </div>
          
          {/* FX Rates Info */}
          <div style={{
            padding: '20px',
            backgroundColor: '#fef3c7',
            borderRadius: '12px',
            border: '2px solid #fbbf24',
            marginTop: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>💱</span>
              <span style={{ fontWeight: 600, fontSize: '16px', color: '#92400e' }}>Historical FX Rates</span>
            </div>
            <div style={{ fontSize: '13px', color: '#92400e' }}>
              Using monthly historical exchange rates for accurate conversion
            </div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#92400e' }}>
              <div><strong>Current Rates (Dec 2025):</strong></div>
              <div>• USD to NGN: 1460</div>
              <div>• MYR to USD: 0.22 (1 MYR = $0.22)</div>
              <div>• EUR to USD: 1.10</div>
              <div>• GHS to USD: 0.089</div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#d97706' }}>
              Rates adjusted monthly based on historical data
            </div>
          </div>
        </div>

        {/* Right Column: Monthly Comparison Chart */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#374151' }}>
                {COMMODITY_CONFIG[selectedCommodity]?.name} - Monthly Price Comparison
              </h3>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {selectedCommodity === 'aluminum' 
                  ? `Negotiated raw material price vs Real market prices (2020-2025) in ${getUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit)}`
                  : `Our purchase prices vs Real market prices (2020-2025) in ${getUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit)}`}
              </div>
            </div>
            <div style={{ 
              display: 'flex',
              gap: '8px'
            }}>
              <div style={{ 
                padding: '6px 12px',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{ width: '10px', height: '3px', backgroundColor: COMMODITY_CONFIG[selectedCommodity]?.excelColor }}></div>
                <span>Our Price: {monthlyComparisonData[selectedCommodity]?.filter(item => item.excelPrice != null).length || 0} months</span>
              </div>
              <div style={{ 
                padding: '6px 12px',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <div style={{ width: '10px', height: '3px', backgroundColor: '#10B981' }}></div>
                <span>Market: {monthlyComparisonData[selectedCommodity]?.filter(item => item.apiPrice != null).length || 0} months</span>
              </div>
            </div>
          </div>
          
          <div style={{ height: '400px' }}>
            {prepareChartData().length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={prepareChartData()}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    tickMargin={10}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    domain={['dataMin', 'dataMax']}
                  />
                  <YAxis 
                    tickFormatter={value => {
                      let dec = decimalsByCommodity[selectedCommodity];
                      if (selectedCommodity === 'wheat') {
                        dec = wheatDisplayUnit === 'bushel' ? dec.bushel : dec.kg;
                      } else if (typeof dec === 'object') {
                        dec = 2;
                      }
                      return `${value.toFixed(dec)}`;
                    }}
                    tick={{ fontSize: 12 }}
                    label={{ 
                      value: getUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit),
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      style: { fontSize: 12 }
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="excelPrice"
                    name={selectedCommodity === 'aluminum' ? 'Negotiated Price' : 'Our Purchase Price'}
                    stroke={COMMODITY_CONFIG[selectedCommodity]?.excelColor}
                    strokeWidth={3}
                    dot={{ r: 4, fill: COMMODITY_CONFIG[selectedCommodity]?.excelColor }}
                    activeDot={{ r: 6, fill: COMMODITY_CONFIG[selectedCommodity]?.excelColor }}
                    connectNulls={true}
                  />
                  <Line
                    type="monotone"
                    dataKey="apiPrice"
                    name="Market Price (Real API)"
                    stroke={COMMODITY_CONFIG[selectedCommodity]?.apiColor}
                    strokeWidth={3}
                    dot={{ r: 4, fill: COMMODITY_CONFIG[selectedCommodity]?.apiColor }}
                    activeDot={{ r: 6, fill: COMMODITY_CONFIG[selectedCommodity]?.apiColor }}
                    connectNulls={false}
                    strokeDasharray={prepareChartData().some(d => d.apiPrice == null) ? "5 5" : "0"}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px dashed #e5e7eb'
              }}>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>No monthly data available</div>
                  <div style={{ fontSize: '14px' }}>No recent data found for this commodity (2020-2025)</div>
                </div>
              </div>
            )}
          </div>

          {/* LIVE PRICES TABLE */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '2px solid #e2e8f0'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '20px' }}>📈</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                  Live Commodity Prices
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Real-time market prices from DDFPlus API in {selectedCommodity === 'palm' ? 'USD/tonne' : getUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit)}
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Refreshing every 5 minutes • Currency Mode: {currencyMode.toUpperCase()} • Using historical FX rates
                  </div>
                </div>
              </div>
            </div>
            
            {loadingLivePrices ? (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <div style={{ marginBottom: '8px' }}>Fetching real-time market prices...</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>Connecting to DDFPlus API...</div>
              </div>
            ) : (
              <div style={{ 
                overflowX: 'auto',
                fontSize: '13px'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Commodity</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Today</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Day %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Week Ago</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Week %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Month Ago</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Month %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Units</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>FX Rate Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHART_COMMODITIES.map((commodity, index) => {
                      const config = COMMODITY_CONFIG[commodity];
                      const liveData = livePrices[commodity];
                      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                      
                      if (!liveData) return null;
                      
                      const targetCurrency = currencyMode === 'original' 
                        ? COMMODITY_CURRENCIES[commodity] 
                        : 'NGN';
                      const units = getUnitsByCommodity(commodity, currencyMode, commodity === 'wheat' ? wheatDisplayUnit : null);
                      
                      let dec = decimalsByCommodity[commodity];
                      if (commodity === 'wheat') {
                        dec = wheatDisplayUnit === 'bushel' ? dec.bushel : dec.kg;
                      } else if (typeof dec === 'object') {
                        dec = 2;
                      }
                      
                      const hasData = liveData.current !== null;
                      const statusColor = hasData ? '#059669' : '#dc2626';
                      
                      // Get FX rate info
                      const fxInfo = commodity === 'palm' ? 'MYR→USD: 0.22' : 
                                     commodity === 'milling_wheat' ? 'EUR→USD: 1.10' :
                                     currencyMode === 'ngn' ? 'USD→NGN: 1460' : '—';
                      
                      return (
                        <tr key={commodity} style={{ backgroundColor: rowBg }}>
                          <td style={{ 
                            padding: '12px', 
                            borderBottom: '1px solid #e2e8f0',
                            fontWeight: '600'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '16px' }}>{config.icon}</span>
                              <div>
                                <div>{config.name}</div>
                                <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                  {config.category} • {COMMODITY_SYMBOLS[commodity]}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          {/* Today */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            fontWeight: '700',
                            color: hasData ? '#374151' : '#9ca3af'
                          }}>
                            {hasData ? liveData.current?.toFixed(dec) : '—'}
                          </td>
                          
                          {/* Day % */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {hasData && liveData.percentages?.day !== null ? (
                              <span style={{
                                fontWeight: '600',
                                color: liveData.percentages.day >= 0 ? '#059669' : '#dc2626',
                                backgroundColor: liveData.percentages.day >= 0 ? '#d1fae5' : '#fee2e2',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {liveData.percentages.day >= 0 ? '▲' : '▼'} {Math.abs(liveData.percentages.day).toFixed(2)}%
                              </span>
                            ) : '—'}
                          </td>
                          
                          {/* Week Ago */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            color: hasData && liveData.weekAgo ? '#6b7280' : '#9ca3af'
                          }}>
                            {hasData && liveData.weekAgo ? liveData.weekAgo.toFixed(dec) : '—'}
                          </td>
                          
                          {/* Week % */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {hasData && liveData.percentages?.week !== null ? (
                              <span style={{
                                fontWeight: '600',
                                color: liveData.percentages.week >= 0 ? '#059669' : '#dc2626',
                                backgroundColor: liveData.percentages.week >= 0 ? '#d1fae5' : '#fee2e2',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {liveData.percentages.week >= 0 ? '▲' : '▼'} {Math.abs(liveData.percentages.week).toFixed(2)}%
                              </span>
                            ) : '—'}
                          </td>
                          
                          {/* Month Ago */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            color: hasData && liveData.monthAgo ? '#6b7280' : '#9ca3af'
                          }}>
                            {hasData && liveData.monthAgo ? liveData.monthAgo.toFixed(dec) : '—'}
                          </td>
                          
                          {/* Month % */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {hasData && liveData.percentages?.month !== null ? (
                              <span style={{
                                fontWeight: '600',
                                color: liveData.percentages.month >= 0 ? '#059669' : '#dc2626',
                                backgroundColor: liveData.percentages.month >= 0 ? '#d1fae5' : '#fee2e2',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {liveData.percentages.month >= 0 ? '▲' : '▼'} {Math.abs(liveData.percentages.month).toFixed(2)}%
                              </span>
                            ) : '—'}
                          </td>
                          
                          {/* Units */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            <span style={{
                              fontWeight: '600',
                              color: '#3B82F6',
                              backgroundColor: '#dbeafe',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px'
                            }}>
                              {units}
                            </span>
                          </td>
                          
                          {/* FX Rate Used */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            fontSize: '11px',
                            color: '#6b7280'
                          }}>
                            {fxInfo}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {/* Live Prices Footer */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '11px',
                  color: '#6b7280'
                }}>
                  <div>
                    <span style={{ fontWeight: '600' }}>Last Updated:</span> {livePrices.wheat?.lastUpdated || 'N/A'}
                    <span style={{ marginLeft: '12px', fontWeight: '600' }}>Currency Mode:</span> {currencyMode.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', backgroundColor: '#059669', borderRadius: '50%' }}></div>
                      <span>Live Data Available</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', backgroundColor: '#dc2626', borderRadius: '50%' }}></div>
                      <span>No Data</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setLoadingLivePrices(true);
                      // Refresh live prices function would be called here
                    }}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Refresh Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with data summary */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px solid #e2e8f0'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Data Sources</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Real-time DDFPlus Commodity API<br/>
              • Excel Purchase Records<br/>
              • Historical Monthly FX Rates<br/>
              • Dates: 2020-2025 only
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Key Features</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Palm Oil: MYR/tonne → USD/tonne<br/>
              • Wheat CBOT: Toggle USD/kg or USD/bushel<br/>
              • Historical FX rates by month<br/>
              • Current USD/NGN: 1460<br/>
              • Real-time API updates
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Refresh Schedule</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Live prices: Every 5 minutes<br/>
              • Historical data: Every 10 minutes<br/>
              • Last API check: {new Date().toLocaleTimeString()}<br/>
              • Mode: Real API Only<br/>
              • Currency: {currencyMode.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommodityDashboard;