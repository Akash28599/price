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

// Import CSV fallback data
import wheatCSV from '../data/wheat.csv';
import millingWheatCSV from '../data/millingwheat.csv';
import palmOilCSV from '../data/palmoil.csv';
import sugarCSV from '../data/sugar.csv';
import aluminumCSV from '../data/alumnium.csv';
import brentCrudeCSV from '../data/brentcrude.csv';

// Commodity symbols for the DDFPlus API
const COMMODITY_SYMBOLS = {
  wheat: 'ZW*1',
  milling_wheat: 'ML*1',
  palm: 'KO*1',
  sugar: 'SB*1',
  aluminum: 'AL*1',
  crude_palm: 'CB*1'
};

// CSV file mapping for fallback data
const CSV_DATA_SOURCES = {
  wheat: wheatCSV,
  milling_wheat: millingWheatCSV,
  palm: palmOilCSV,
  sugar: sugarCSV,
  aluminum: aluminumCSV,
  crude_palm: brentCrudeCSV
};

// Function to parse CSV data
function parseCSVData(csvText, symbol) {
  if (!csvText) return [];
  
  const lines = csvText.trim().split('\n');
  const data = [];
  
  lines.forEach((line, index) => {
    const parts = line.split(',').map(p => p.trim());
    
    if (parts.length >= 6) {
      // Check if symbol matches or if it's a generic CSV
      const lineSymbol = parts[0];
      const dateStr = parts[1];
      const open = parseFloat(parts[2]);
      const high = parseFloat(parts[3]);
      const low = parseFloat(parts[4]);
      const close = parseFloat(parts[5]);
      const volume = parts.length > 6 ? parseInt(parts[6]) : 0;
      
      // Only add if symbol matches or if it's the first column (some CSVs might not have symbol)
      if ((!symbol || lineSymbol.includes(symbol.substring(0, 2))) && !isNaN(close)) {
        data.push({
          symbol: lineSymbol,
          date: dateStr,
          open,
          high,
          low,
          close,
          volume
        });
      }
    }
  });
  
  return data.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// NEW: Function to get CSV data for live price simulation
async function getCSVDataForLivePrice(commodity) {
  try {
    const csvSource = CSV_DATA_SOURCES[commodity];
    if (!csvSource) {
      console.warn(`No CSV fallback for ${commodity}`);
      return null;
    }
    
    const response = await fetch(csvSource);
    const csvText = await response.text();
    const symbol = COMMODITY_SYMBOLS[commodity];
    const allData = parseCSVData(csvText, symbol);
    
    if (allData.length === 0) {
      console.warn(`No CSV data for ${commodity}`);
      return null;
    }
    
    // Sort by date ascending
    const sortedData = allData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log(`CSV data for ${commodity}:`, {
      totalRecords: sortedData.length,
      firstDate: sortedData[0]?.date,
      lastDate: sortedData[sortedData.length - 1]?.date,
      latestPrice: sortedData[sortedData.length - 1]?.close
    });
    
    return sortedData;
    
  } catch (error) {
    console.error(`Error fetching CSV data for ${commodity} live price:`, error);
    return null;
  }
}

// NEW: Function to simulate live prices from CSV
function simulateLivePricesFromCSV(csvData) {
  if (!csvData || csvData.length === 0) {
    console.warn('No CSV data for simulation');
    return null;
  }
  
  // CSV data is sorted ascending, so last entry is most recent
  const latestIndex = csvData.length - 1;
  const latest = csvData[latestIndex];
  
  // Find "yesterday" - the day before the latest date
  const latestDate = new Date(latest.date);
  const yesterdayDate = new Date(latestDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  
  let yesterday = null;
  for (let i = latestIndex - 1; i >= 0; i--) {
    const itemDate = new Date(csvData[i].date);
    if (itemDate <= yesterdayDate) {
      yesterday = csvData[i];
      break;
    }
  }
  
  // If no exact yesterday, take the previous trading day
  if (!yesterday && latestIndex > 0) {
    yesterday = csvData[latestIndex - 1];
  }
  
  // Find "week ago" - 7 days before latest
  const weekAgoDate = new Date(latestDate);
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  
  let weekAgo = null;
  for (let i = latestIndex - 1; i >= 0; i--) {
    const itemDate = new Date(csvData[i].date);
    if (itemDate <= weekAgoDate) {
      weekAgo = csvData[i];
      break;
    }
  }
  
  // Find "month ago" - approximately 30 days before latest
  const monthAgoDate = new Date(latestDate);
  monthAgoDate.setMonth(monthAgoDate.getMonth() - 1);
  
  let monthAgo = null;
  for (let i = latestIndex - 1; i >= 0; i--) {
    const itemDate = new Date(csvData[i].date);
    if (itemDate <= monthAgoDate) {
      monthAgo = csvData[i];
      break;
    }
  }
  
  // Find "year ago" - approximately 365 days before latest
  const yearAgoDate = new Date(latestDate);
  yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);
  
  let yearAgo = null;
  for (let i = 0; i < csvData.length; i++) {
    const itemDate = new Date(csvData[i].date);
    if (itemDate >= yearAgoDate) {
      yearAgo = csvData[i];
      break;
    }
  }
  
  return {
    current: latest.close,
    previous: yesterday ? yesterday.close : null,
    weekAgo: weekAgo ? weekAgo.close : null,
    monthAgo: monthAgo ? monthAgo.close : null,
    yearAgo: yearAgo ? yearAgo.close : null,
    date: latest.date,
    weekAgoDate: weekAgo ? weekAgo.date : null,
    monthAgoDate: monthAgo ? monthAgo.date : null,
    yearAgoDate: yearAgo ? yearAgo.date : null,
    source: 'csv',
    csvDataLength: csvData.length
  };
}

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
    USD_to_NGN: 1460,
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

// NEW: Function to fetch data from CSV fallback
async function fetchDataFromCSV(commodity, startDate, endDate) {
  try {
    const csvSource = CSV_DATA_SOURCES[commodity];
    if (!csvSource) {
      console.warn(`No CSV fallback for ${commodity}`);
      return [];
    }
    
    const response = await fetch(csvSource);
    const csvText = await response.text();
    const symbol = COMMODITY_SYMBOLS[commodity];
    const allData = parseCSVData(csvText, symbol);
    
    // Filter by date range
    const filteredData = allData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
    
    console.log(`Fetched ${filteredData.length} records from CSV for ${commodity}`, {
      startDate,
      endDate,
      totalRecords: allData.length
    });
    
    return filteredData;
    
  } catch (error) {
    console.error(`Error fetching CSV data for ${commodity}:`, error);
    return [];
  }
}

// NEW: Function to fetch monthly prices from CSV if API fails
async function fetchMonthlyPricesWithFallback(symbol, commodity, months) {
  try {
    const apiResults = await fetchMonthlyPricesWithVariation(symbol, months);
    
    // If API returns data, use it
    if (apiResults.length > 0) {
      console.log(`Using API data for ${commodity}: ${apiResults.length} months`);
      return {
        data: apiResults,
        source: 'api'
      };
    }
    
    // If API fails or returns no data, try CSV fallback
    console.log(`API returned no data for ${commodity}, trying CSV fallback...`);
    
    const csvMonthlyResults = [];
    const recentMonths = months.filter(monthKey => {
      const year = parseInt(monthKey.split('-')[0]);
      return year >= 2020;
    });
    
    for (const month of recentMonths) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      const startStr = formatDateForAPI(startDate);
      const endStr = formatDateForAPI(endDate);
      
      const csvData = await fetchDataFromCSV(commodity, startStr, endStr);
      
      if (csvData.length > 0) {
        const sum = csvData.reduce((sum, day) => sum + day.close, 0);
        const monthlyAvg = sum / csvData.length;
        
        csvMonthlyResults.push({
          monthKey: month,
          avgPrice: monthlyAvg,
          dataPoints: csvData.length,
          source: 'csv'
        });
        
        console.log(`✅ ${month} from CSV for ${commodity}: ${csvData.length} days, avg: ${monthlyAvg.toFixed(2)}`);
      }
    }
    
    if (csvMonthlyResults.length > 0) {
      return {
        data: csvMonthlyResults,
        source: 'csv'
      };
    }
    
    // If both API and CSV fail
    return {
      data: [],
      source: 'none'
    };
    
  } catch (error) {
    console.error(`Error in fetchMonthlyPricesWithFallback for ${commodity}:`, error);
    return {
      data: [],
      source: 'error'
    };
  }
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
            sampleDates: dailyPrices.slice(0, 3).map(d => d.date),
            source: 'api'
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
  const [dataSource, setDataSource] = useState({}); // Track data source for each commodity
  const [priceAlerts, setPriceAlerts] = useState([]); // NEW: Store price alerts

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

  // NEW: Function to check for price alerts
  const checkPriceAlerts = (commodity, liveData) => {
    const alerts = [];
    
    if (liveData && liveData.percentages) {
      // Check for significant daily drop (>1%)
      if (liveData.percentages.day !== null && liveData.percentages.day < -1) {
        alerts.push({
          commodity,
          type: 'price_drop',
          message: `Significant price drop: ${Math.abs(liveData.percentages.day).toFixed(2)}% today`,
          severity: 'high',
          percentage: liveData.percentages.day,
          timestamp: new Date()
        });
      }
      
      // Check for weekly drop (>3%)
      if (liveData.percentages.week !== null && liveData.percentages.week < -3) {
        alerts.push({
          commodity,
          type: 'weekly_drop',
          message: `Weekly price decline: ${Math.abs(liveData.percentages.week).toFixed(2)}% this week`,
          severity: 'medium',
          percentage: liveData.percentages.week,
          timestamp: new Date()
        });
      }
      
      // Check for monthly drop (>5%)
      if (liveData.percentages.month !== null && liveData.percentages.month < -5) {
        alerts.push({
          commodity,
          type: 'monthly_drop',
          message: `Monthly price decline: ${Math.abs(liveData.percentages.month).toFixed(2)}% this month`,
          severity: 'high',
          percentage: liveData.percentages.month,
          timestamp: new Date()
        });
      }
    }
    
    return alerts;
  };

  // UPDATED: Fetch live prices with CSV fallback
  // UPDATED: Fetch live prices with CSV fallback
useEffect(() => {
  const fetchLivePrices = async () => {
    setLoadingLivePrices(true);
    setApiStatus('fetching_live');
    
    try {
      const liveData = {};
      const newAlerts = [];
      
      for (const [commodity, symbol] of Object.entries(COMMODITY_SYMBOLS)) {
        console.log(`Fetching live price for ${commodity} (${symbol})...`);
        
        let priceData = null;
        let dataSourceType = 'none';
        
        // First, always try to get CSV data (since API might fail)
        const csvData = await getCSVDataForLivePrice(commodity);
        
        if (csvData && csvData.length > 0) {
          // Use CSV data to simulate live prices
          priceData = simulateLivePricesFromCSV(csvData);
          dataSourceType = 'csv';
          
          console.log(`✅ Using CSV fallback for ${commodity}:`, {
            current: priceData?.current,
            latestDate: priceData?.date,
            csvRecords: csvData.length
          });
        }
        
        // If we have no CSV data either, set null values
        if (!priceData) {
          console.warn(`No data available for ${commodity}`);
          liveData[commodity] = {
            current: null,
            previous: null,
            weekAgo: null,
            monthAgo: null,
            yearAgo: null,
            percentages: { day: null, week: null, month: null, year: null },
            symbol,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'no_data',
            source: 'none'
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
          status: priceData.current ? 'success' : 'no_data',
          source: dataSourceType,
          rawData: {
            currentUSD: priceData.current,
            previousUSD: priceData.previous,
            weekAgoUSD: priceData.weekAgo,
            monthAgoUSD: priceData.monthAgo,
            yearAgoUSD: priceData.yearAgo
          },
          csvInfo: priceData.csvDataLength ? `${priceData.csvDataLength} records` : null,
          latestDate: priceData.date,
          csvFallbackInfo: dataSourceType === 'csv' ? `Using CSV: ${csvData.length} records, latest: ${priceData.date}` : null
        };
        
        // Check for price alerts
        const commodityAlerts = checkPriceAlerts(commodity, liveData[commodity]);
        newAlerts.push(...commodityAlerts);
        
        console.log(`Live price for ${commodity} in ${targetCurrency}:`, {
          current: displayCurrent,
          source: dataSourceType,
          percentages,
          csvRecords: csvData?.length || 0
        });
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setLivePrices(liveData);
      setApiStatus('connected');
      
      // Update alerts if there are new ones
      if (newAlerts.length > 0) {
        setPriceAlerts(prev => [...newAlerts, ...prev].slice(0, 10)); // Keep last 10 alerts
      }
      
    } catch (error) {
      console.error('Error fetching live prices:', error);
      setApiStatus('error');
      
      // Even on error, try to load CSV data
      const fallbackData = {};
      try {
        for (const [commodity, symbol] of Object.entries(COMMODITY_SYMBOLS)) {
          const csvData = await getCSVDataForLivePrice(commodity);
          if (csvData && csvData.length > 0) {
            const priceData = simulateLivePricesFromCSV(csvData);
            
            if (priceData && priceData.current) {
              const targetCurrency = currencyMode === 'original' 
                ? COMMODITY_CURRENCIES[commodity] 
                : 'NGN';
              
              const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
              const current = convertApiValueToTargetCurrency(commodity, priceData.current, targetCurrency, currentMonthKey);
              const previous = priceData.previous ? convertApiValueToTargetCurrency(commodity, priceData.previous, targetCurrency, currentMonthKey) : null;
              
              let displayCurrent = current;
              if (commodity === 'wheat' && wheatDisplayUnit === 'usdPerKg' && current) {
                displayCurrent = current / BUSHEL_TO_KG_WHEAT;
              }
              
              const percentages = {
                day: previous ? calculatePercentageChange(displayCurrent, previous) : null,
                week: null,
                month: null,
                year: null
              };
              
              fallbackData[commodity] = {
                current: displayCurrent,
                previous,
                weekAgo: null,
                monthAgo: null,
                yearAgo: null,
                percentages,
                symbol,
                lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'csv_fallback',
                source: 'csv',
                latestDate: priceData.date,
                csvFallbackInfo: `Error fallback: ${csvData.length} CSV records`
              };
            }
          }
        }
      } catch (csvError) {
        console.error('Even CSV fallback failed:', csvError);
      }
      
      // Merge any CSV fallback data
      setLivePrices(prev => ({ ...prev, ...fallbackData }));
      
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
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              dataSource: 'none'
            };
          }
          
          const excelMonths = excelMonthly.map(item => item.monthKey);
          const result = await fetchMonthlyPricesWithFallback(symbol, commodity, excelMonths);
          
          const apiMonthly = processApiDataByMonth(commodity, result.data, currencyMode, wheatDisplayUnit);
          const combinedData = combineMonthlyData(excelMonthly, apiMonthly, commodity, wheatDisplayUnit);
          
          const apiPrices = combinedData.filter(d => d.apiPrice).map(d => d.apiPrice);
          const uniquePrices = [...new Set(apiPrices.map(p => p?.toFixed(2)))];
          const hasVariation = uniquePrices.length > 1;
          
          return {
            commodity,
            symbol,
            monthlyComparisonData: combinedData,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            hasVariation,
            dataSource: result.source
          };
        });

        const results = await Promise.all(dataPromises);
        
        const dataObj = {};
        const comparisonObj = {};
        const sourceObj = {};
        
        results.forEach(result => {
          dataObj[result.commodity] = result;
          comparisonObj[result.commodity] = result.monthlyComparisonData;
          sourceObj[result.commodity] = result.dataSource;
        });
        
        setCommodityData(dataObj);
        setMonthlyComparisonData(comparisonObj);
        setDataSource(sourceObj);
        
        const apiDataSummary = Object.keys(comparisonObj).map(commodity => {
          const data = comparisonObj[commodity];
          const source = sourceObj[commodity];
          const apiMonths = data.filter(d => d.apiPrice != null).length;
          const totalMonths = data.length;
          const apiPrices = data.filter(d => d.apiPrice).map(d => d.apiPrice);
          const uniquePrices = [...new Set(apiPrices.map(p => p?.toFixed(2)))];
          const hasVariation = uniquePrices.length > 1;
          
          return `${commodity}: ${apiMonths}/${totalMonths} ${source === 'api' ? '🌐' : source === 'csv' ? '📁' : '⚠️'} ${hasVariation ? '✓' : '⚠️'}`;
        }).join(' | ');
        
        setDataDebug(`Data Sources: ${apiDataSummary} | Currency Mode: ${currencyMode.toUpperCase()} | Wheat Unit: ${wheatDisplayUnit}`);
        setApiStatus('connected');
        
      } catch (err) {
        console.error('Error in fetchAllCommodityData:', err);
        setError(`Failed to fetch data: ${err.message}. Please check your API connection.`);
        setApiStatus('error');
        
        const emptyData = {};
        const emptyComparison = {};
        const emptySource = {};
        
        Object.keys(COMMODITY_CONFIG).forEach(commodity => {
          const excelMonthly = excelMonthlyData[commodity] || [];
          const combinedData = excelMonthly.map(item => ({
            monthKey: item.monthKey,
            monthDisplay: item.monthDisplay,
            excelPrice: item.excelPrice,
            apiPrice: null,
            excelTransactions: item.transactionCount,
            apiDataPoints: 0,
            apiSource: 'none'
          }));
          
          emptyData[commodity] = {
            commodity,
            symbol: COMMODITY_SYMBOLS[commodity],
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          
          emptyComparison[commodity] = combinedData;
          emptySource[commodity] = 'none';
        });
        
        setCommodityData(emptyData);
        setMonthlyComparisonData(emptyComparison);
        setDataSource(emptySource);
      } finally {
        setLoading(false);
      }
    };

    fetchAllCommodityData();
    
    const intervalId = setInterval(fetchAllCommodityData, 10 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [excelMonthlyData, currencyMode, wheatDisplayUnit]);

  // UPDATED: Fetch daily prices with CSV fallback
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
      return []; // Return empty array, CSV fallback will be used
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
    const dataSourceIcon = data.apiSource === 'csv' ? '📁' : data.apiSource === 'api' ? '🌐' : '';

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
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Market Price {dataSourceIcon} {data.apiSource === 'csv' ? '(CSV)' : data.apiSource === 'api' ? '(API)' : ''}
              </span>
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
        <div style={{ marginBottom: '16px' }}>Loading Commodity Insights Dashboard...</div>
        <div style={{ color: '#666', fontSize: '14px' }}>Processing Excel data and fetching market prices...</div>
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
              📈 Commodity Insights Dashboard
            </h2>
            <div style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
              Monthly Averages: Our Purchases vs Market Prices | 
              Currency Mode: {currencyMode === 'original' ? 'Document Currency' : 'NGN'} |
              Data Sources: {Object.values(dataSource).filter(s => s === 'api').length} API, {Object.values(dataSource).filter(s => s === 'csv').length} CSV
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
              {Object.values(dataSource).some(s => s === 'csv') ? '📁 CSV Fallback Active' : '🌐 Real API Data'}
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
        
        {/* NEW: Price Alerts Section */}
        {priceAlerts.length > 0 && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            border: '2px solid #fbbf24',
            animation: 'pulse 2s infinite'
          }}>
            <style>
              {`
                @keyframes pulse {
                  0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                  70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
                  100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
              `}
            </style>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <span style={{ fontWeight: '600', fontSize: '16px', color: '#92400e' }}>
                Price Alerts ({priceAlerts.length})
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {priceAlerts.slice(0, 3).map((alert, index) => {
                const config = COMMODITY_CONFIG[alert.commodity];
                return (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: alert.severity === 'high' ? '#fee2e2' : '#fef3c7',
                      borderRadius: '6px',
                      border: `1px solid ${alert.severity === 'high' ? '#fca5a5' : '#fbbf24'}`,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{config?.icon}</span>
                    <span style={{ color: alert.severity === 'high' ? '#dc2626' : '#92400e' }}>
                      {alert.message}
                    </span>
                    <span style={{ 
                      fontWeight: 'bold',
                      color: alert.severity === 'high' ? '#dc2626' : '#92400e',
                      fontSize: '11px'
                    }}>
                      {alert.percentage < 0 ? '▼' : '▲'} {Math.abs(alert.percentage).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
              {priceAlerts.length > 3 && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#6b7280'
                }}>
                  +{priceAlerts.length - 3} more alerts
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Currency Mode Info with Alerts */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: currencyMode === 'original' ? '#dbeafe' : '#d1fae5',
          borderRadius: '8px',
          border: `2px solid ${currencyMode === 'original' ? '#3B82F6' : '#10B981'}`,
          marginBottom: '16px',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>
              {currencyMode === 'original' ? '💰' : '🇳🇬'}
            </span>
            <div style={{ flex: 1 }}>
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
            
            {/* Alert Notification Bell */}
            <div style={{
              position: 'relative',
              cursor: 'pointer'
            }}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              {priceAlerts.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  animation: 'bounce 1s infinite'
                }}>
                  {priceAlerts.length}
                </div>
              )}
              <style>
                {`
                  @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                  }
                `}
              </style>
            </div>
          </div>
          
          {/* Alert Configuration */}
          <div style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: 'rgba(255,255,255,0.5)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#6b7280'
          }}>
            <span style={{ fontWeight: '600' }}>Alerts Active:</span> 
            Daily drop &gt;1% • Weekly drop &gt;3% • Monthly drop &gt;5%
          </div>
        </div>
        
        {/* NEW: Wheat Display Unit Selector - MOVED TO TOP RIGHT OF CHART SECTION */}
        
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
              {apiStatus === 'connected' ? 
                `LIVE MODE: ${Object.values(dataSource).filter(s => s === 'api').length} APIs, ${Object.values(dataSource).filter(s => s === 'csv').length} CSVs` :
               apiStatus === 'error' ? 'API ERROR: Using CSV fallback data' :
               'CONNECTING: Fetching real-time market data...'}
            </span>
          </div>
          
          <div style={{
            fontSize: '11px',
            color: apiStatus === 'connected' ? '#059669' : 
                   apiStatus === 'error' ? '#dc2626' : '#d97706',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span style={{ 
                backgroundColor: '#3B82F6', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: '3px',
                fontSize: '10px'
              }}>
                API: {Object.values(dataSource).filter(s => s === 'api').length}
              </span>
              <span style={{ 
                backgroundColor: '#8B5CF6', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: '3px',
                fontSize: '10px'
              }}>
                CSV: {Object.values(dataSource).filter(s => s === 'csv').length}
              </span>
            </div>
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
        <strong>Data Sources:</strong> {dataDebug || 'Loading...'} | 
        <strong> Alerts:</strong> {priceAlerts.length} active | 
        <strong> Currency:</strong> {currencyMode.toUpperCase()} | 
        <strong>Current USD/NGN:</strong> 1460
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
          const source = dataSource[commodity] || 'none';
          const targetCurrency = currencyMode === 'original' 
            ? COMMODITY_CURRENCIES[commodity] 
            : 'NGN';
          const units = getUnitsByCommodity(commodity, currencyMode, commodity === 'wheat' ? wheatDisplayUnit : null);
          
          // Check for live price alerts for this commodity
          const commodityAlerts = priceAlerts.filter(alert => alert.commodity === commodity);
          const hasAlerts = commodityAlerts.length > 0;
          
          return (
            <button
              key={commodity}
              onClick={() => setSelectedCommodity(commodity)}
              style={{
                padding: '12px 20px',
                backgroundColor: isSelected ? '#1e40af' : 
                                hasAlerts ? '#fef3c7' : '#f3f4f6',
                color: isSelected ? 'white' : 
                       hasAlerts ? '#92400e' : '#374151',
                border: `2px solid ${isSelected ? '#1e40af' : 
                                    hasAlerts ? '#fbbf24' : '#e5e7eb'}`,
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
              
              {hasAlerts && (
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  animation: 'pulse 2s infinite'
                }}>
                  {commodityAlerts.length}
                </div>
              )}
              
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
                        (hasVariation ? '#10B981' : '#f59e0b') : 
                        (source === 'csv' ? '#8B5CF6' : '#9ca3af'),
                      color: 'white',
                      padding: '1px 3px',
                      borderRadius: '2px'
                    }}>
                      {monthsWithApiData}
                    </span>
                  </span>
                  <span style={{
                    fontSize: '8px',
                    color: source === 'api' ? '#059669' : 
                           source === 'csv' ? '#8B5CF6' : '#9ca3af',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    {source === 'api' ? '🌐' : source === 'csv' ? '📁' : '⚠️'} 
                    {apiCoverage}%
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
              const source = dataSource[commodity] || 'none';
              const targetCurrency = currencyMode === 'original' 
                ? COMMODITY_CURRENCIES[commodity] 
                : 'NGN';
              const units = getUnitsByCommodity(commodity, currencyMode, commodity === 'wheat' ? wheatDisplayUnit : null);
              
              // Check for live price alerts
              const commodityAlerts = priceAlerts.filter(alert => alert.commodity === commodity);
              const hasAlerts = commodityAlerts.length > 0;
              
              return (
                <div 
                  key={commodity}
                  style={{
                    padding: '16px',
                    backgroundColor: commodity === selectedCommodity ? '#eff6ff' : 
                                    hasAlerts ? '#fef3c7' : 'white',
                    borderRadius: '12px',
                    border: `2px solid ${commodity === selectedCommodity ? '#3B82F6' : 
                                            hasAlerts ? '#fbbf24' : '#e5e7eb'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  onClick={() => setSelectedCommodity(commodity)}
                >
                  {hasAlerts && (
                    <div style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      animation: 'pulse 2s infinite'
                    }}>
                      {commodityAlerts.length}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{config.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: hasAlerts ? '#92400e' : '#374151' }}>{config.name}</div>
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
                          (source === 'api' ? '#10B981' : 
                           source === 'csv' ? '#8B5CF6' : '#f59e0b') : '#9ca3af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{hasApiData ? (source === 'api' ? '🌐' : source === 'csv' ? '📁' : '⚠️') : '✗'}</span>
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
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>Data Coverage:</span>
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
                            backgroundColor: apiCoverage >= 80 ? 
                              (source === 'api' ? '#10B981' : '#8B5CF6') : 
                              apiCoverage >= 50 ? '#f59e0b' : '#ef4444',
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
                          ⚠️ Constant prices 
                        </div>
                      )}
                      {hasAlerts && (
                        <div style={{ 
                          fontSize: '10px',
                          color: '#dc2626',
                          backgroundColor: '#fee2e2',
                          padding: '2px 4px',
                          borderRadius: '3px',
                          textAlign: 'center',
                          marginTop: '4px'
                        }}>
                          🔔 {commodityAlerts.length} alert{commodityAlerts.length !== 1 ? 's' : ''}
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
                      <div>Data: {source === 'api' ? 'API' : source === 'csv' ? 'CSV' : 'None'} ({wheatDisplayUnit === 'bushel' ? 'USD/bushel' : 'USD/kg'})</div>
                      <div>1 bushel = {BUSHEL_TO_KG_WHEAT.toFixed(2)} kg wheat</div>
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
                  {dataSource[selectedCommodity] === 'api' ? 'DDFPlus API' : 
                   dataSource[selectedCommodity] === 'csv' ? 'CSV Fallback' : 
                   'No Data'} prices converted to {currencyMode === 'original' ? 'document currency' : 'NGN'}
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    {dataSource[selectedCommodity] === 'csv' ? '📁 Using historical CSV data' :
                     selectedCommodity === 'wheat' ? 'ZW*1: CBOT Wheat Futures (cents/bushel)' : 
                     selectedCommodity === 'milling_wheat' ? 'ML*1: Milling Wheat Futures' : 
                     selectedCommodity === 'palm' ? 'KO*1: Palm Oil Futures (MYR/tonne)' :
                     'Real-time commodity data'}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ color: '#8B5CF6', fontWeight: 600, marginBottom: '4px' }}>📁 CSV Fallback</div>
                <div style={{ color: '#374151' }}>
                  When API fails, uses 5-year historical CSV data
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    Data format: Symbol,Date,Open,High,Low,Close,Volume
                  </div>
                </div>
              </div>
              <div>
                <div style={{ color: '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>🔔 Price Alerts</div>
                <div style={{ color: '#374151' }}>
                  Automatic alerts for price drops: &gt;1% daily, &gt;3% weekly, &gt;5% monthly
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    {priceAlerts.length} active alerts across all commodities
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
          
          {/* CSV Fallback Info */}
          <div style={{
            padding: '20px',
            backgroundColor: '#fef3c7',
            borderRadius: '12px',
            border: '2px solid #fbbf24',
            marginTop: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>📁</span>
              <span style={{ fontWeight: 600, fontSize: '16px', color: '#92400e' }}>CSV Fallback System</span>
            </div>
            <div style={{ fontSize: '13px', color: '#92400e' }}>
              When API fails, automatically uses CSV data for live prices
            </div>
            <div style={{ marginTop: '12px', fontSize: '12px', color: '#92400e' }}>
              <div><strong>CSV Live Price Simulation:</strong></div>
              <div>• Last CSV date = "Today" price</div>
              <div>• Previous trading day = "Yesterday"</div>
              <div>• ~7 days ago = "Week Ago"</div>
              <div>• ~30 days ago = "Month Ago"</div>
              <div>• ~365 days ago = "Year Ago"</div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#d97706' }}>
              Using actual historical dates from CSV for accurate percentage calculations
            </div>
          </div>
        </div>

        {/* Right Column: Monthly Comparison Chart */}
        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
            gap: '16px'
          }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#374151' }}>
                {COMMODITY_CONFIG[selectedCommodity]?.name} - Monthly Price Comparison
              </h3>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {selectedCommodity === 'aluminum' 
                  ? `Negotiated raw material price vs Market prices (2020-2025) in ${getUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit)}`
                  : `Our purchase prices vs Market prices (2020-2025) in ${getUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit)}`}
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  Data Source: {dataSource[selectedCommodity] === 'api' ? '🌐 Live API' : 
                               dataSource[selectedCommodity] === 'csv' ? '📁 CSV Fallback' : 
                               '⚠️ No Market Data'}
                </div>
              </div>
            </div>
            
            {/* NEW: Wheat Display Unit Selector - MOVED HERE */}
            {selectedCommodity === 'wheat' && (
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '2px solid #bae6fd',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '200px'
              }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#0369a1', whiteSpace: 'nowrap' }}>
                  Display Unit:
                </span>
                <select
                  value={wheatDisplayUnit}
                  onChange={(e) => setWheatDisplayUnit(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'white',
                    border: '1px solid #3B82F6',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#1e40af',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  {WHEAT_DISPLAY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
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
                {dataSource[selectedCommodity] === 'csv' && (
                  <span style={{ fontSize: '10px', color: '#8B5CF6' }}>(CSV)</span>
                )}
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
                    name={`Market Price ${dataSource[selectedCommodity] === 'csv' ? '(CSV)' : dataSource[selectedCommodity] === 'api' ? '(API)' : ''}`}
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

          {/* UPDATED: LIVE PRICES TABLE WITH CSV FALLBACK */}
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
                  Real-time market prices from {Object.values(dataSource).some(s => s === 'csv') ? 'CSV fallback' : 'DDFPlus API'} in {selectedCommodity === 'palm' ? 'USD/tonne' : getUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit)}
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    Refreshing every 5 minutes • Currency Mode: {currencyMode.toUpperCase()} • Using historical FX rates
                    {Object.values(livePrices).some(lp => lp.source === 'csv') && ' • 📁 CSV Fallback Active'}
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
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  {Object.values(dataSource).some(s => s === 'csv') ? 'Using CSV fallback data' : 'Connecting to DDFPlus API...'}
                </div>
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
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Data Source</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Latest Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHART_COMMODITIES.map((commodity, index) => {
                      const config = COMMODITY_CONFIG[commodity];
                      const liveData = livePrices[commodity];
                      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                      const source = liveData?.source || 'none';
                      
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
                      
                      // Check for alerts
                      const hasAlerts = priceAlerts.filter(a => a.commodity === commodity).length > 0;
                      
                      return (
                        <tr key={commodity} style={{ 
                          backgroundColor: rowBg,
                          ...(hasAlerts && { borderLeft: '4px solid #fbbf24' })
                        }}>
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
                              {hasAlerts && (
                                <span style={{
                                  backgroundColor: '#ef4444',
                                  color: 'white',
                                  borderRadius: '50%',
                                  width: '16px',
                                  height: '16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '9px',
                                  fontWeight: 'bold',
                                  animation: 'pulse 2s infinite'
                                }}>
                                  !
                                </span>
                              )}
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
                            {hasData ? (
                              <div>
                                <div>{liveData.current?.toFixed(dec)}</div>
                                <div style={{ fontSize: '11px', color: '#6b7280' }}>{units}</div>
                              </div>
                            ) : '—'}
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
                                color: liveData.percentages.day >= 0 ? '#059669' : 
                                      (liveData.percentages.day < -1 ? '#dc2626' : '#d97706'),
                                backgroundColor: liveData.percentages.day >= 0 ? '#d1fae5' : 
                                                (liveData.percentages.day < -1 ? '#fee2e2' : '#fef3c7'),
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                border: liveData.percentages.day < -1 ? '1px solid #fca5a5' : 'none'
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
                            {hasData && liveData.weekAgo ? (
                              <div>
                                <div>{liveData.weekAgo.toFixed(dec)}</div>
                                <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                                  {liveData.weekAgoDate ? new Date(liveData.weekAgoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                </div>
                              </div>
                            ) : '—'}
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
                                color: liveData.percentages.week >= 0 ? '#059669' : 
                                      (liveData.percentages.week < -3 ? '#dc2626' : '#d97706'),
                                backgroundColor: liveData.percentages.week >= 0 ? '#d1fae5' : 
                                                (liveData.percentages.week < -3 ? '#fee2e2' : '#fef3c7'),
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                border: liveData.percentages.week < -3 ? '1px solid #fca5a5' : 'none'
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
                            {hasData && liveData.monthAgo ? (
                              <div>
                                <div>{liveData.monthAgo.toFixed(dec)}</div>
                                <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                                  {liveData.monthAgoDate ? new Date(liveData.monthAgoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                </div>
                              </div>
                            ) : '—'}
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
                                color: liveData.percentages.month >= 0 ? '#059669' : 
                                      (liveData.percentages.month < -5 ? '#dc2626' : '#d97706'),
                                backgroundColor: liveData.percentages.month >= 0 ? '#d1fae5' : 
                                                (liveData.percentages.month < -5 ? '#fee2e2' : '#fef3c7'),
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                border: liveData.percentages.month < -5 ? '1px solid #fca5a5' : 'none'
                              }}>
                                {liveData.percentages.month >= 0 ? '▲' : '▼'} {Math.abs(liveData.percentages.month).toFixed(2)}%
                              </span>
                            ) : '—'}
                          </td>
                          
                          {/* Data Source */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            <span style={{
                              fontWeight: '600',
                              color: source === 'api' ? '#10B981' : 
                                    source === 'csv' ? '#8B5CF6' : '#9ca3af',
                              backgroundColor: source === 'api' ? '#d1fae5' : 
                                            source === 'csv' ? '#e9d5ff' : '#e5e7eb',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {source === 'api' ? '🌐 API' : 
                               source === 'csv' ? '📁 CSV' : '⚠️ None'}
                            </span>
                          </td>
                          
                          {/* Latest Date */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            fontSize: '11px',
                            color: '#6b7280'
                          }}>
                            {liveData.latestDate ? (
                              <div>
                                <div>{new Date(liveData.latestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                                {liveData.csvInfo && (
                                  <div style={{ fontSize: '9px', color: '#8B5CF6' }}>
                                    {liveData.csvInfo}
                                  </div>
                                )}
                              </div>
                            ) : '—'}
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
                    <span style={{ marginLeft: '12px', fontWeight: '600' }}>Alerts:</span> {priceAlerts.length} active
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', backgroundColor: '#10B981', borderRadius: '50%' }}></div>
                      <span>API Data</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', backgroundColor: '#8B5CF6', borderRadius: '50%' }}></div>
                      <span>CSV Fallback</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '8px', height: '8px', backgroundColor: '#fbbf24', borderRadius: '50%' }}></div>
                      <span>Alert Active</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setLoadingLivePrices(true);
                      const fetchLivePrices = async () => {
                        // Trigger a refresh
                        // This would typically call your fetch function again
                        // For now, we'll just simulate a refresh
                        setTimeout(() => setLoadingLivePrices(false), 1000);
                      };
                      fetchLivePrices();
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
              • 5-year Historical CSV Fallback<br/>
              • Excel Purchase Records<br/>
              • Historical Monthly FX Rates<br/>
              • Dates: 2020-2025 only
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Key Features</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Automatic CSV fallback when API fails<br/>
              • CSV Live Price Simulation<br/>
              • Price drop alerts (>1% daily, >3% weekly, >5% monthly)<br/>
              • Wheat: Toggle USD/kg or USD/bushel<br/>
              • Historical FX rates by month<br/>
              • Current USD/NGN: 1460<br/>
              • Real-time API updates
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>CSV Fallback Logic</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Last CSV date = "Today" price<br/>
              • Previous date = "Yesterday"<br/>
              • ~7 days ago = "Week Ago"<br/>
              • ~30 days ago = "Month Ago"<br/>
              • ~365 days ago = "Year Ago"<br/>
              • Using actual CSV dates for accuracy
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommodityDashboard;