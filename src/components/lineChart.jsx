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

// Function to get CSV data for live price simulation
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
    
    return sortedData;
    
  } catch (error) {
    console.error(`Error fetching CSV data for ${commodity} live price:`, error);
    return null;
  }
}

// Function to simulate live prices from CSV
function simulateLivePricesFromCSV(csvData, commodity) {
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
    csvDataLength: csvData.length,
    // Store the original API value exactly as received
    baseApiValue: latest.close
  };
}

// Historical monthly FX rates (based on actual market data)
const HISTORICAL_FX_RATES = {
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
  
  const monthRates = HISTORICAL_FX_RATES[monthKey] || HISTORICAL_FX_RATES['current'];
  
  const directKey = `${fromCurrency}_to_${toCurrency}`;
  if (monthRates[directKey]) {
    return monthRates[directKey];
  }
  
  const reverseKey = `${toCurrency}_to_${fromCurrency}`;
  if (monthRates[reverseKey]) {
    return 1 / monthRates[reverseKey];
  }
  
  if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
    const toUSD = getHistoricalFXRate(monthKey, fromCurrency, 'USD');
    const fromUSD = getHistoricalFXRate(monthKey, 'USD', toCurrency);
    if (toUSD && fromUSD) {
      return toUSD * fromUSD;
    }
  }
  
  console.warn(`No FX rate found for ${fromCurrency} to ${toCurrency} for ${monthKey}`);
  return 1;
}

// Conversion factors
const BUSHEL_TO_KG_WHEAT = 27.2155;
const TONNE_TO_KG = 1000;
const LB_TO_KG = 0.45359237;
const ALUMINUM_CAN_WEIGHT_KG = 0.013;
const BARREL_TO_KG = 136.4;

// Wheat display unit options
const WHEAT_DISPLAY_OPTIONS = [
  { value: 'usdPerKg', label: 'USD/kg' },
  { value: 'bushel', label: 'USD/bushel' }
];

// Currency configuration for each commodity
const COMMODITY_CURRENCIES = {
  wheat: 'USD',
  milling_wheat: 'USD',
  palm: 'USD',
  crude_palm: 'USD',
  sugar: 'NGN',
  aluminum: 'USD'
};

// Fixed: Proper units based on currency mode and commodity
const getUnitsByCommodity = (commodity, currencyMode, displayUnit = null) => {
  const targetCurrency = currencyMode === 'original' 
    ? COMMODITY_CURRENCIES[commodity] 
    : 'NGN';
  
  // Handle palm oil - always use per kg in NGN mode
  if (commodity === 'palm') {
    if (currencyMode === 'ngn') {
      return 'NGN/kg';
    }
    return 'USD/tonne';
  }
  
  if (commodity === 'wheat' && displayUnit === 'bushel') {
    return `${targetCurrency}/bushel`;
  }
  
  // For NGN mode, show per kg for all commodities except palm (handled above)
  if (currencyMode === 'ngn') {
    return `${targetCurrency}/kg`;
  }
  
  // Original currency mode
  if (commodity === 'wheat' || commodity === 'milling_wheat' || 
      commodity === 'crude_palm') {
    return `${targetCurrency}/kg`;
  }
  if(commodity==="aluminum"){
    return `${targetCurrency}/tonne`
  }
  
  return `${targetCurrency}/kg`;
};

const decimalsByCommodity = {
  wheat: { kg: 3, bushel: 2 },
  milling_wheat: 3,
  palm: { usdPerTonne: 2, ngnPerKg: 2 }, // USD/tonne or NGN/kg
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
    name: 'Brent Crude Oil', 
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
    name: 'Aluminum',
    icon: '🥫', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    category: 'Metals',
    showInChart: true
  }
};

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

// Convert API value to target currency
function convertApiValueToTargetCurrency(commodity, apiValue, targetCurrency, monthKey = null, wheatDisplayUnit = 'usdPerKg') {
  if (apiValue == null || isNaN(Number(apiValue))) return null;
  const value = Number(apiValue);

  let apiPriceInOriginalCurrency;
  let apiCurrency;

  switch(commodity) {
    case 'wheat':
      const usdPerBushel = value / 100;
      apiPriceInOriginalCurrency = usdPerBushel;
      apiCurrency = 'USD';
      
      if (wheatDisplayUnit === 'usdPerKg') {
        apiPriceInOriginalCurrency = usdPerBushel / BUSHEL_TO_KG_WHEAT;
      }
      break;

    case 'milling_wheat':
      const eurPerTonne = value;
      apiPriceInOriginalCurrency = eurPerTonne / TONNE_TO_KG;
      apiCurrency = 'EUR';
      break;

    case 'palm':
      // Palm Oil: MYR per metric ton
      const myrPerTonne = value;
      apiPriceInOriginalCurrency = myrPerTonne;
      apiCurrency = 'MYR';
      break;

    case 'crude_palm':
      apiPriceInOriginalCurrency = value / BARREL_TO_KG;
      apiCurrency = 'USD';
      break;
    
    case 'sugar':
      const usdPerLb = value / 100;
      apiPriceInOriginalCurrency = usdPerLb / LB_TO_KG;
      apiCurrency = 'USD';
      break;

    case 'aluminum':
      apiPriceInOriginalCurrency = value;
      apiCurrency = 'USD';
      break;

    default:
      return value;
  }

  // Convert to target currency if needed
  if (apiCurrency !== targetCurrency) {
    const fxRate = getHistoricalFXRate(monthKey || 'current', apiCurrency, targetCurrency);
    const convertedValue = apiPriceInOriginalCurrency * fxRate;
    
    // Special handling for palm oil in different modes
    if (commodity === 'palm') {
      if (targetCurrency === 'NGN') {
        // Convert USD/tonne to NGN/kg
        const usdPerTonne = convertedValue;
        const usdPerKg = usdPerTonne / TONNE_TO_KG;
        const ngnPerKg = usdPerKg * getHistoricalFXRate(monthKey || 'current', 'USD', 'NGN');
        return ngnPerKg;
      }
      // For USD mode, return USD/tonne
      return convertedValue;
    }
    
    return convertedValue;
  }

  return apiPriceInOriginalCurrency;
}

// Convert Excel purchase price to target currency
function convertExcelPriceToTargetCurrency(commodity, excelItem, targetCurrency, monthKey = null, wheatDisplayUnit = 'usdPerKg') {
  if (!excelItem) return null;
  
  let priceInOriginalCurrency;
  let excelCurrency;
  
  switch(commodity) {
    case 'wheat':
    case 'milling_wheat':
      if (excelItem.currency === 'GHS') {
        const fxRate = getHistoricalFXRate(monthKey, 'GHS', 'USD');
        priceInOriginalCurrency = excelItem.rate * fxRate;
        excelCurrency = 'USD';
      } else {
        priceInOriginalCurrency = excelItem.rate;
        excelCurrency = excelItem.currency;
      }
      
      if (commodity === 'wheat' && wheatDisplayUnit === 'bushel') {
        priceInOriginalCurrency = priceInOriginalCurrency * BUSHEL_TO_KG_WHEAT;
      }
      break;
      
    case 'palm':
      // FIX: Excel data has fob in USD/tonne and costPerUnit in USD/kg
      if (excelItem.fob) {
        priceInOriginalCurrency = excelItem.fob; // USD/tonne
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
      priceInOriginalCurrency = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE;
      excelCurrency = 'USD';
      break;
      
    default:
      return null;
  }

  // Convert to target currency if needed
  if (excelCurrency !== targetCurrency) {
    const fxRate = getHistoricalFXRate(monthKey, excelCurrency, targetCurrency);
    const convertedValue = priceInOriginalCurrency * fxRate;
    
    // Special handling for palm oil in NGN mode
    if (commodity === 'palm' && targetCurrency === 'NGN') {
      // Convert USD/tonne to NGN/kg
      const usdPerTonne = convertedValue;
      const usdPerKg = usdPerTonne / TONNE_TO_KG;
      const ngnPerKg = usdPerKg * getHistoricalFXRate(monthKey, 'USD', 'NGN');
      return ngnPerKg;
    }
    
    return convertedValue;
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

// Process Excel data by month
function processExcelDataByMonth(commodity, currencyMode, wheatDisplayUnit = 'usdPerKg') {
  const rawData = EXCEL_DATA_SOURCES[commodity] || [];
  
  const targetCurrency = currencyMode === 'original' 
    ? COMMODITY_CURRENCIES[commodity] 
    : 'NGN';
  
  const monthlyData = {};
  
  rawData.forEach((item, index) => {
    const dateStr = getExcelDateForMonth(commodity, item);
    const monthKey = getMonthKey(dateStr);
    
    if (!monthKey) return;
    
    const year = parseInt(monthKey.split('-')[0]);
    const currentYear = new Date().getFullYear();
    
    if (year < 2020 || year > currentYear + 1) return;
    
    const priceInTargetCurrency = convertExcelPriceToTargetCurrency(commodity, item, targetCurrency, monthKey, wheatDisplayUnit);
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
  
  return filterRecentData(result, 5);
}

// Function to fetch data from CSV fallback
async function fetchDataFromCSV(commodity, startDate, endDate) {
  try {
    const csvSource = CSV_DATA_SOURCES[commodity];
    if (!csvSource) return [];
    
    const response = await fetch(csvSource);
    const csvText = await response.text();
    const symbol = COMMODITY_SYMBOLS[commodity];
    const allData = parseCSVData(csvText, symbol);
    
    const filteredData = allData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
    });
    
    return filteredData;
    
  } catch (error) {
    console.error(`Error fetching CSV data for ${commodity}:`, error);
    return [];
  }
}

// Function to fetch monthly prices from CSV if API fails
async function fetchMonthlyPricesWithFallback(symbol, commodity, months, wheatDisplayUnit = 'usdPerKg') {
  try {
    const apiResults = await fetchMonthlyPricesWithVariation(symbol, months);
    
    if (apiResults.length > 0) {
      return {
        data: apiResults,
        source: 'api'
      };
    }
    
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
      }
    }
    
    if (csvMonthlyResults.length > 0) {
      return {
        data: csvMonthlyResults,
        source: 'csv'
      };
    }
    
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
    
    if (recentMonths.length === 0) return [];
    
    for (const month of recentMonths) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      const startStr = formatDateForAPI(startDate);
      const endStr = formatDateForAPI(endDate);
      
      const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${startStr}&enddate=${endStr}`;
      
      try {
        const response = await fetch(url);
        
        if (!response.ok) continue;
        
        const text = await response.text();
        
        if (!text || text.includes('error') || text.includes('No data')) continue;
        
        const lines = text.trim().split('\n').filter(line => line.trim() && !line.includes('error'));
        
        const dailyPrices = [];
        
        lines.forEach((line) => {
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

// Process API data by month
function processApiDataByMonth(commodity, apiMonthlyData, currencyMode, wheatDisplayUnit = 'usdPerKg') {
  const targetCurrency = currencyMode === 'original' 
    ? COMMODITY_CURRENCIES[commodity] 
    : 'NGN';
  
  return apiMonthlyData.map(item => {
    let apiPrice = convertApiValueToTargetCurrency(commodity, item.avgPrice, targetCurrency, item.monthKey, wheatDisplayUnit);
    
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
    
    // Calculate profit/loss percentage
    let profitLossPercentage = null;
    if (excelPrice && apiPrice) {
      profitLossPercentage = ((excelPrice - apiPrice) / apiPrice) * 100;
    }
    
    return {
      monthKey,
      monthDisplay: getMonthDisplay(monthKey),
      excelPrice: excelPrice,
      apiPrice: apiPrice,
      profitLossPercentage: profitLossPercentage,
      excelTransactions: excelMonth?.transactionCount || 0,
      apiDataPoints: apiMonth?.dataPoints || 0,
      apiSource: apiMonth?.source || 'none'
    };
  });
}

// Helper function to get appropriate decimals
const getDecimalsForDisplay = (commodity, currencyMode, wheatDisplayUnit) => {
  const dec = decimalsByCommodity[commodity];
  
  if (commodity === 'wheat') {
    return wheatDisplayUnit === 'bushel' ? dec.bushel : dec.kg;
  }
  
  if (commodity === 'palm') {
    if (currencyMode === 'ngn') {
      return dec.ngnPerKg || 2;
    }
    return dec.usdPerTonne || 2;
  }
  
  if (typeof dec === 'object') {
    return 2;
  }
  
  return dec || 2;
};

// NEW: Helper function to get original API units for display in live prices table
const getOriginalUnitsForLivePrices = (commodity) => {
  switch(commodity) {
    case 'wheat':
      return 'cents/bushel';
    case 'milling_wheat':
      return 'EUR/tonne';
    case 'palm':
      return 'MYR/tonne';
    case 'crude_palm':
      return 'USD/barrel';
    case 'sugar':
      return 'cents/lb';
    case 'aluminum':
      return 'USD/tonne';
    default:
      return '';
  }
};

// NEW: Helper function to format API price exactly as received
function formatOriginalApiPrice(commodity, apiValue) {
  if (apiValue == null || isNaN(Number(apiValue))) return null;
  const value = Number(apiValue);
  
  switch(commodity) {
    case 'wheat':
      return value; // cents per bushel
    case 'milling_wheat':
      return value; // EUR per tonne
    case 'palm':
      return value; // MYR per tonne
    case 'crude_palm':
      return value; // USD per barrel
    case 'sugar':
      return value; // cents per pound
    case 'aluminum':
      return value; // USD per tonne
    default:
      return value;
  }
};

// NEW: Helper function to get decimals for original API prices
const getOriginalDecimalsForDisplay = (commodity) => {
  switch(commodity) {
    case 'wheat':
      return 2; // cents/bushel
    case 'milling_wheat':
      return 2; // EUR/tonne
    case 'palm':
      return 2; // MYR/tonne
    case 'crude_palm':
      return 2; // USD/barrel
    case 'sugar':
      return 2; // cents/lb
    case 'aluminum':
      return 2; // USD/tonne
    default:
      return 2;
  }
};

const CommodityDashboard = () => {
  const [currencyMode, setCurrencyMode] = useState('original');
  const [selectedCommodity, setSelectedCommodity] = useState(DEFAULT_CHART_COMMODITY);
  const [wheatDisplayUnit, setWheatDisplayUnit] = useState('usdPerKg');
  const [commodityData, setCommodityData] = useState({});
  const [monthlyComparisonData, setMonthlyComparisonData] = useState({});
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingLivePrices, setLoadingLivePrices] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('connecting');
  const [dataSource, setDataSource] = useState({});
  const [priceAlerts, setPriceAlerts] = useState([]);

  // Process Excel data by month
  const excelMonthlyData = useMemo(() => {
    const data = {};
    Object.keys(COMMODITY_CONFIG).forEach(commodity => {
      data[commodity] = processExcelDataByMonth(commodity, currencyMode, wheatDisplayUnit);
    });
    
    if (!data.aluminum || data.aluminum.length === 0) {
      const months = [];
      const currentDate = new Date();
      const startDate = new Date(2020, 0, 1);
      
      const targetCurrency = currencyMode === 'original' ? 'USD' : 'NGN';
      const baseUsdPerKg = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE ;
      
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
    }
    
    return data;
  }, [currencyMode, wheatDisplayUnit]);

  // Function to check for price alerts
  const checkPriceAlerts = (commodity, liveData) => {
    const alerts = [];
    
    if (liveData && liveData.percentages) {
      if (liveData.percentages.day !== null && liveData.percentages.day < -1) {
        alerts.push({
          commodity,
          type: 'price_drop',
          message: `Price drop: ${Math.abs(liveData.percentages.day).toFixed(2)}% today`,
          severity: liveData.percentages.day < -5 ? 'high' : 'medium',
          percentage: liveData.percentages.day,
          timestamp: new Date()
        });
      }
      
      if (liveData.percentages.week !== null && liveData.percentages.week < -3) {
        alerts.push({
          commodity,
          type: 'weekly_drop',
          message: `Weekly decline: ${Math.abs(liveData.percentages.week).toFixed(2)}% this week`,
          severity: liveData.percentages.week < -7 ? 'high' : 'medium',
          percentage: liveData.percentages.week,
          timestamp: new Date()
        });
      }
      
      if (liveData.percentages.month !== null && liveData.percentages.month < -5) {
        alerts.push({
          commodity,
          type: 'monthly_drop',
          message: `Monthly decline: ${Math.abs(liveData.percentages.month).toFixed(2)}% this month`,
          severity: liveData.percentages.month < -10 ? 'high' : 'medium',
          percentage: liveData.percentages.month,
          timestamp: new Date()
        });
      }
    }
    
    return alerts;
  };

  // Fetch live prices
  useEffect(() => {
    const fetchLivePrices = async () => {
      setLoadingLivePrices(true);
      setApiStatus('fetching_live');
      
      try {
        const liveData = {};
        const newAlerts = [];
        
        for (const [commodity, symbol] of Object.entries(COMMODITY_SYMBOLS)) {
          let priceData = null;
          let dataSourceType = 'none';
          
          const csvData = await getCSVDataForLivePrice(commodity);
          
          if (csvData && csvData.length > 0) {
            priceData = simulateLivePricesFromCSV(csvData, commodity);
            dataSourceType = 'csv';
          }
          
          if (!priceData) {
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
              source: 'none',
              originalApiValue: null
            };
            continue;
          }
          
          const targetCurrency = currencyMode === 'original' 
            ? COMMODITY_CURRENCIES[commodity] 
            : 'NGN';
          
          const currentDate = new Date();
          const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
          
          const current = convertApiValueToTargetCurrency(commodity, priceData.current, targetCurrency, currentMonthKey, wheatDisplayUnit);
          const previous = priceData.previous ? convertApiValueToTargetCurrency(commodity, priceData.previous, targetCurrency, currentMonthKey, wheatDisplayUnit) : null;
          
          let weekAgo = null, monthAgo = null, yearAgo = null;
          
          if (priceData.weekAgo && priceData.weekAgoDate) {
            const weekMonthKey = getMonthKey(priceData.weekAgoDate);
            weekAgo = convertApiValueToTargetCurrency(commodity, priceData.weekAgo, targetCurrency, weekMonthKey, wheatDisplayUnit);
          }
          
          if (priceData.monthAgo && priceData.monthAgoDate) {
            const monthMonthKey = getMonthKey(priceData.monthAgoDate);
            monthAgo = convertApiValueToTargetCurrency(commodity, priceData.monthAgo, targetCurrency, monthMonthKey, wheatDisplayUnit);
          }
          
          if (priceData.yearAgo && priceData.yearAgoDate) {
            const yearMonthKey = getMonthKey(priceData.yearAgoDate);
            yearAgo = convertApiValueToTargetCurrency(commodity, priceData.yearAgo, targetCurrency, yearMonthKey, wheatDisplayUnit);
          }
          
          const percentages = {
            day: previous ? calculatePercentageChange(current, previous) : null,
            week: weekAgo ? calculatePercentageChange(current, weekAgo) : null,
            month: monthAgo ? calculatePercentageChange(current, monthAgo) : null,
            year: yearAgo ? calculatePercentageChange(current, yearAgo) : null
          };
          
          liveData[commodity] = {
            current: current,
            previous,
            weekAgo,
            monthAgo,
            yearAgo,
            percentages,
            symbol,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: priceData.current ? 'success' : 'no_data',
            source: dataSourceType,
            latestDate: priceData.date,
            csvFallbackInfo: dataSourceType === 'csv' ? `Using CSV: ${csvData.length} records, latest: ${priceData.date}` : null,
            // Store the original API value exactly as received
            originalApiValue: priceData.baseApiValue || priceData.current
          };
          
          const commodityAlerts = checkPriceAlerts(commodity, liveData[commodity]);
          newAlerts.push(...commodityAlerts);
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        setLivePrices(liveData);
        setApiStatus('connected');
        
        if (newAlerts.length > 0) {
          setPriceAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
        }
        
      } catch (error) {
        console.error('Error fetching live prices:', error);
        setApiStatus('error');
        
        const fallbackData = {};
        try {
          for (const [commodity, symbol] of Object.entries(COMMODITY_SYMBOLS)) {
            const csvData = await getCSVDataForLivePrice(commodity);
            if (csvData && csvData.length > 0) {
              const priceData = simulateLivePricesFromCSV(csvData, commodity);
              
              if (priceData && priceData.current) {
                const targetCurrency = currencyMode === 'original' 
                  ? COMMODITY_CURRENCIES[commodity] 
                  : 'NGN';
                
                const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                const current = convertApiValueToTargetCurrency(commodity, priceData.current, targetCurrency, currentMonthKey, wheatDisplayUnit);
                const previous = priceData.previous ? convertApiValueToTargetCurrency(commodity, priceData.previous, targetCurrency, currentMonthKey, wheatDisplayUnit) : null;
                
                const percentages = {
                  day: previous ? calculatePercentageChange(current, previous) : null,
                  week: null,
                  month: null,
                  year: null
                };
                
                fallbackData[commodity] = {
                  current: current,
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
                  csvFallbackInfo: `Error fallback: ${csvData.length} CSV records`,
                  // Store original API value
                  originalApiValue: priceData.baseApiValue || priceData.current
                };
              }
            }
          }
        } catch (csvError) {
          console.error('Even CSV fallback failed:', csvError);
        }
        
        setLivePrices(prev => ({ ...prev, ...fallbackData }));
        
      } finally {
        setLoadingLivePrices(false);
      }
    };

    fetchLivePrices();
    
    const intervalId = setInterval(fetchLivePrices, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [currencyMode, wheatDisplayUnit]);

  // Fetch API data and combine with Excel data
  useEffect(() => {
    const fetchAllCommodityData = async () => {
      setLoading(true);
      setError('');
      setApiStatus('fetching_historical');
      
      try {
        const dataPromises = Object.entries(COMMODITY_SYMBOLS).map(async ([commodity, symbol]) => {
          const excelMonthly = excelMonthlyData[commodity] || [];
          
          if (excelMonthly.length === 0) {
            return {
              commodity,
              symbol,
              monthlyComparisonData: [],
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              dataSource: 'none'
            };
          }
          
          const excelMonths = excelMonthly.map(item => item.monthKey);
          const result = await fetchMonthlyPricesWithFallback(symbol, commodity, excelMonths, wheatDisplayUnit);
          
          const apiMonthly = processApiDataByMonth(commodity, result.data, currencyMode, wheatDisplayUnit);
          const combinedData = combineMonthlyData(excelMonthly, apiMonthly, commodity, wheatDisplayUnit);
          
          return {
            commodity,
            symbol,
            monthlyComparisonData: combinedData,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            hasVariation: true,
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
            profitLossPercentage: null,
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

  function calculatePercentageChange(current, previous) {
    if (!previous || previous === 0 || !current) return null;
    return ((current - previous) / previous) * 100;
  }

  // NEW: Calculate profit/loss metrics for a commodity
  const calculateProfitLossMetrics = (commodity) => {
    const data = monthlyComparisonData[commodity] || [];
    const monthsWithData = data.filter(item => item.excelPrice && item.apiPrice);
    
    if (monthsWithData.length === 0) return null;
    
    const totalProfitLoss = monthsWithData.reduce((sum, item) => {
      const profitLoss = ((item.excelPrice - item.apiPrice) / item.apiPrice) * 100;
      return sum + profitLoss;
    }, 0);
    
    const avgProfitLoss = totalProfitLoss / monthsWithData.length;
    
    const profitableMonths = monthsWithData.filter(item => item.profitLossPercentage < 0).length;
    const lossMonths = monthsWithData.filter(item => item.profitLossPercentage > 0).length;
    const profitablePercentage = (profitableMonths / monthsWithData.length) * 100;
    
    const bestMonth = monthsWithData.reduce((best, current) => {
      if (!best) return current;
      return current.profitLossPercentage < best.profitLossPercentage ? current : best;
    }, null);
    
    const worstMonth = monthsWithData.reduce((worst, current) => {
      if (!worst) return current;
      return current.profitLossPercentage > worst.profitLossPercentage ? current : worst;
    }, null);
    
    const currentMonth = data[data.length - 1];
    const currentProfitLoss = currentMonth?.profitLossPercentage;
    
    return {
      avgProfitLoss,
      profitableMonths,
      lossMonths,
      totalMonths: monthsWithData.length,
      profitablePercentage,
      bestMonth,
      worstMonth,
      currentProfitLoss,
      hasData: monthsWithData.length > 0
    };
  };

  // Prepare chart data for selected commodity
  const prepareChartData = () => {
    const data = monthlyComparisonData[selectedCommodity] || [];
    const filteredData = data.filter(item => item.excelPrice != null);
    
    return filteredData.map(item => ({
      month: item.monthDisplay,
      monthKey: item.monthKey,
      excelPrice: item.excelPrice,
      apiPrice: item.apiPrice,
      profitLossPercentage: item.profitLossPercentage,
      excelTransactions: item.excelTransactions,
      apiDataPoints: item.apiDataPoints,
      apiSource: item.apiSource
    }));
  };

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    const config = COMMODITY_CONFIG[selectedCommodity];
    
    const dec = getDecimalsForDisplay(selectedCommodity, currencyMode, wheatDisplayUnit);
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
                Negotiated price
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
        
        {data.profitLossPercentage !== null && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px',
            backgroundColor: '#f8fafc',
            borderRadius: '6px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Profit/Loss:</span>
              <span style={{ 
                fontWeight: 'bold',
                fontSize: '14px',
                color: data.profitLossPercentage <= 0 ? '#059669' : '#dc2626'
              }}>
                {data.profitLossPercentage <= 0 ? '🟢 SAVING' : '🔴 LOSS'} 
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Amount:</span>
              <span style={{ 
                fontWeight: '600',
                fontSize: '13px',
                color: data.profitLossPercentage <= 0 ? '#059669' : '#dc2626'
              }}>
                {Math.abs(data.profitLossPercentage).toFixed(1)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Per unit:</span>
              <span style={{ 
                fontWeight: '600',
                fontSize: '13px',
                color: data.profitLossPercentage <= 0 ? '#059669' : '#dc2626'
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

  const profitLossMetrics = calculateProfitLossMetrics(selectedCommodity);
  const units = getUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit);
  const dec = getDecimalsForDisplay(selectedCommodity, currencyMode, wheatDisplayUnit);

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
              📈 Commodity Insights Platform
            </h2>
            <div style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
              {currencyMode === 'original' ? 'Document Currency Mode' : 'NGN Mode'} | 
              Live Data: {Object.values(dataSource).filter(s => s === 'api').length} API, {Object.values(dataSource).filter(s => s === 'csv').length} CSV
            </div>
          </div>
          
          {/* Currency Toggle Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
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
        
        {/* Price Alerts Section */}
        {priceAlerts.length > 0 && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#fee2e2',
            borderRadius: '8px',
            border: '2px solid #ef4444'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <span style={{ fontWeight: '600', fontSize: '16px', color: '#dc2626' }}>
                Price Drop Alerts ({priceAlerts.length})
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
                      backgroundColor: alert.severity === 'high' ? '#fecaca' : '#fed7aa',
                      borderRadius: '6px',
                      border: `1px solid ${alert.severity === 'high' ? '#f87171' : '#fb923c'}`,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{config?.icon}</span>
                    <span style={{ color: alert.severity === 'high' ? '#b91c1c' : '#c2410c' }}>
                      {alert.message}
                    </span>
                    <span style={{ 
                      fontWeight: 'bold',
                      color: alert.severity === 'high' ? '#b91c1c' : '#c2410c',
                      fontSize: '11px'
                    }}>
                      ▼ {Math.abs(alert.percentage).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Currency Mode Info */}
        
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
                'LIVE' :
               apiStatus === 'error' ? 'API ERROR - USING CSV FALLBACK' :
               'CONNECTING TO MARKET DATA...'}
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
          </div>
        </div>
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
          const source = dataSource[commodity] || 'none';
          
          const profitLossMetrics = calculateProfitLossMetrics(commodity);
          const currentProfitLoss = profitLossMetrics?.currentProfitLoss;
          
          const commodityAlerts = priceAlerts.filter(alert => alert.commodity === commodity);
          const hasAlerts = commodityAlerts.length > 0;
          
          return (
            <button
              key={commodity}
              onClick={() => setSelectedCommodity(commodity)}
              style={{
                padding: '12px 20px',
                backgroundColor: isSelected ? '#1e40af' : 
                                hasAlerts ? '#fee2e2' : '#f3f4f6',
                color: isSelected ? 'white' : 
                       hasAlerts ? '#dc2626' : '#374151',
                border: `2px solid ${isSelected ? '#1e40af' : 
                                    hasAlerts ? '#ef4444' : '#e5e7eb'}`,
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
                  {getUnitsByCommodity(commodity, currencyMode, commodity === 'wheat' ? wheatDisplayUnit : null)}
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
                  fontWeight: 'bold'
                }}>
                  {commodityAlerts.length}
                </div>
              )}
              
              {currentProfitLoss !== null && currentProfitLoss !== undefined && (
                <div style={{
                  marginLeft: 'auto',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: currentProfitLoss <= 0 ? '#059669' : '#dc2626',
                  backgroundColor: currentProfitLoss <= 0 ? '#d1fae5' : '#fee2e2',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  {currentProfitLoss <= 0 ? '🟢' : '🔴'} {Math.abs(currentProfitLoss).toFixed(1)}%
                </div>
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
        {/* Left Column: Performance Metrics */}
        <div>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#374151' }}>
            Performance Metrics
          </h3>
          
          {/* Profit/Loss Summary Card */}
          {profitLossMetrics && profitLossMetrics.hasData && (
            <div style={{
              padding: '20px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '2px solid #e2e8f0',
              marginBottom: '24px'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '24px' }}>📊</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                    {COMMODITY_CONFIG[selectedCommodity]?.name} Performance
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Historical Analysis ({profitLossMetrics.totalMonths} months)
                  </div>
                </div>
              </div>
              
              {/* Overall Performance */}
              <div style={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Average Profit/Loss</span>
                  <span style={{ 
                    fontSize: '20px', 
                    fontWeight: 'bold',
                    color: profitLossMetrics.avgProfitLoss <= 0 ? '#059669' : '#dc2626'
                  }}>
                    {profitLossMetrics.avgProfitLoss <= 0 ? '🟢 SAVING' : '🔴 LOSS'} {Math.abs(profitLossMetrics.avgProfitLoss).toFixed(1)}%
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'right' }}>
                  {profitLossMetrics.avgProfitLoss <= 0 
                    ? 'You paid LESS than market price on average'
                    : 'You paid MORE than market price on average'}
                </div>
              </div>
              
              {/* Monthly Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: '#d1fae5',
                  borderRadius: '6px',
                  border: '1px solid #10b981',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#065f46' }}>
                    {profitLossMetrics.profitableMonths}
                  </div>
                  <div style={{ fontSize: '11px', color: '#059669' }}>
                    Profitable Months
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                    {profitLossMetrics.profitablePercentage.toFixed(0)}% of time
                  </div>
                </div>
                
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fee2e2',
                  borderRadius: '6px',
                  border: '1px solid #ef4444',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#b91c1c' }}>
                    {profitLossMetrics.lossMonths}
                  </div>
                  <div style={{ fontSize: '11px', color: '#dc2626' }}>
                    Loss Months
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                    {100 - profitLossMetrics.profitablePercentage.toFixed(0)}% of time
                  </div>
                </div>
              </div>
              
              {/* Best & Worst Month */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}>
                {profitLossMetrics.bestMonth && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f0f9ff',
                    borderRadius: '6px',
                    border: '1px solid #0ea5e9'
                  }}>
                    <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: '600' }}>
                      Best Month
                    </div>
                    <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                      {profitLossMetrics.bestMonth.monthDisplay}
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: 'bold',
                      color: '#059669',
                      marginTop: '2px'
                    }}>
                      SAVED {Math.abs(profitLossMetrics.bestMonth.profitLossPercentage).toFixed(1)}%
                    </div>
                  </div>
                )}
                
                {profitLossMetrics.worstMonth && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#fef2f2',
                    borderRadius: '6px',
                    border: '1px solid #ef4444'
                  }}>
                    <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>
                      Worst Month
                    </div>
                    <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                      {profitLossMetrics.worstMonth.monthDisplay}
                    </div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: 'bold',
                      color: '#dc2626',
                      marginTop: '2px'
                    }}>
                      LOSS {Math.abs(profitLossMetrics.worstMonth.profitLossPercentage).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Current Position Card */}
          <div style={{
            padding: '20px',
            backgroundColor: '#f0f9ff',
            borderRadius: '12px',
            border: '2px solid ',
            marginBottom: '24px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '24px' }}>💰</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '16px', color: '#0369a1' }}>
                  Current Position
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {COMMODITY_CONFIG[selectedCommodity]?.name} | {units}
                </div>
              </div>
            </div>
            
            <div style={{
              padding: '16px',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              marginBottom: '12px'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Your Price</span>
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold',
                  color: '#3B82F6'
                }}>
                  {monthlyComparisonData[selectedCommodity]?.[monthlyComparisonData[selectedCommodity]?.length - 1]?.excelPrice?.toFixed(dec) || 'N/A'} {units}
                </span>
              </div>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Market Price</span>
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold',
                  color: '#10B981'
                }}>
                  {monthlyComparisonData[selectedCommodity]?.[monthlyComparisonData[selectedCommodity]?.length - 1]?.apiPrice?.toFixed(dec) || 'N/A'} {units}
                </span>
              </div>
            </div>
            
            {profitLossMetrics?.currentProfitLoss !== null && profitLossMetrics?.currentProfitLoss !== undefined && (
              <div style={{
                padding: '12px',
                backgroundColor: profitLossMetrics.currentProfitLoss <= 0 ? '#d1fae5' : '#fee2e2',
                borderRadius: '6px',
                border: `1px solid ${profitLossMetrics.currentProfitLoss <= 0 ? '#10b981' : '#ef4444'}`,
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  color: profitLossMetrics.currentProfitLoss <= 0 ? '#065f46' : '#b91c1c',
                  marginBottom: '4px'
                }}>
                  {profitLossMetrics.currentProfitLoss <= 0 ? '🟢 YOU ARE SAVING' : '🔴 YOU ARE PAYING MORE'}
                </div>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: 'bold',
                  color: profitLossMetrics.currentProfitLoss <= 0 ? '#059669' : '#dc2626'
                }}>
                  {Math.abs(profitLossMetrics.currentProfitLoss).toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                  {profitLossMetrics.currentProfitLoss <= 0 
                    ? 'Your price is BELOW market average'
                    : 'Your price is ABOVE market average'}
                </div>
              </div>
            )}
          </div>
          
          {/* Data Quality Card */}
          <div style={{
            padding: '20px',
            backgroundColor: '#fef3c7',
            borderRadius: '12px',
            border: '2px solid'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '24px' }}>📈</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '16px', color: '#92400e' }}>
                  Data Quality
                </div>
                <div style={{ fontSize: '12px', color: '#d97706' }}>
                  Coverage & Reliability
                </div>
              </div>
            </div>
            
            <div style={{
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#92400e' }}>Market Data Coverage</span>
                <span style={{ 
                  fontSize: '13px', 
                  fontWeight: 'bold',
                  color: dataSource[selectedCommodity] === 'api' ? '#10B981' : 
                         dataSource[selectedCommodity] === 'csv' ? '#8B5CF6' : '#9ca3af'
                }}>
                  {dataSource[selectedCommodity] === 'api' ? '🌐 LIVE API' : 
                   dataSource[selectedCommodity] === 'csv' ? '📁 CSV FALLBACK' : 
                   '⚠️ NO DATA'}
                </span>
              </div>
              
              <div style={{ 
                height: '8px',
                backgroundColor: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '8px'
              }}>
                <div 
                  style={{
                    height: '100%',
                    width: `${(monthlyComparisonData[selectedCommodity]?.filter(item => item.apiPrice != null).length / monthlyComparisonData[selectedCommodity]?.length * 100) || 0}%`,
                    backgroundColor: dataSource[selectedCommodity] === 'api' ? '#10B981' : '#8B5CF6',
                    borderRadius: '4px'
                  }}
                />
              </div>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#92400e'
              }}>
                <span>{monthlyComparisonData[selectedCommodity]?.filter(item => item.apiPrice != null).length || 0} of {monthlyComparisonData[selectedCommodity]?.length || 0} months</span>
                <span>{Math.round((monthlyComparisonData[selectedCommodity]?.filter(item => item.apiPrice != null).length / monthlyComparisonData[selectedCommodity]?.length * 100) || 0)}% coverage</span>
              </div>
            </div>
            
            <div style={{
              fontSize: '12px',
              color: '#92400e',
              lineHeight: '1.5'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ 
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#10B981',
                  borderRadius: '50%'
                }}></span>
                <span>Live API Data: Real-time market prices</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ 
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#8B5CF6',
                  borderRadius: '50%'
                }}></span>
                <span>CSV Fallback: Historical data when API fails</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ 
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#9ca3af',
                  borderRadius: '50%'
                }}></span>
                <span>Your Data: Excel purchase records</span>
              </div>
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
                {COMMODITY_CONFIG[selectedCommodity]?.name} - Price Comparison
              </h3>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                Your purchase price vs Market price ({units}) • 2020-2025
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  {dataSource[selectedCommodity] === 'api' ? '🌐 Live Market Data' : 
                   dataSource[selectedCommodity] === 'csv' ? '📁 Historical CSV Data' : 
                   '⚠️ Limited Data Available'}
                  {selectedCommodity === 'wheat' && (
                    <span> • Display: {wheatDisplayUnit === 'bushel' ? 'USD/bushel' : 'USD/kg'}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Wheat Display Unit Selector */}
            {selectedCommodity === 'wheat' && (
              <div style={{
                padding: '8px 12px',
                backgroundColor: '#f0f9ff',
                borderRadius: '8px',
                border: '2px solid ',
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
                <span>Your Price</span>
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
                <span>Market Price</span>
                {dataSource[selectedCommodity] === 'csv' && (
                  <span style={{ fontSize: '10px', color: '#8B5CF6' }}>(API)</span>
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
                    tickFormatter={value => `${value.toFixed(dec)}`}
                    tick={{ fontSize: 12 }}
                    label={{ 
                      value: units,
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
                    name="Your Purchase Price"
                    stroke={COMMODITY_CONFIG[selectedCommodity]?.excelColor}
                    strokeWidth={3}
                    dot={{ r: 4, fill: COMMODITY_CONFIG[selectedCommodity]?.excelColor }}
                    activeDot={{ r: 6, fill: COMMODITY_CONFIG[selectedCommodity]?.excelColor }}
                    connectNulls={true}
                  />
                  <Line
                    type="monotone"
                    dataKey="apiPrice"
                    name={`Market Price ${dataSource[selectedCommodity] === 'csv' ? '(CSV)' : ''}`}
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

          {/* Live Prices Table */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '2px solid ',
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
                  Live Market Prices
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Real-time updates • Refreshing every 5 minutes • {currencyMode.toUpperCase()} Mode
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
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Current</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Day %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Week %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Month %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Source</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Alert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHART_COMMODITIES.map((commodity, index) => {
                      const config = COMMODITY_CONFIG[commodity];
                      const liveData = livePrices[commodity];
                      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                      const source = liveData?.source || 'none';
                      
                      if (!liveData) return null;
                      
                      // Original API units and values
                      const originalUnits = getOriginalUnitsForLivePrices(commodity);
                      const originalDecimals = getOriginalDecimalsForDisplay(commodity);
                      const originalPrice = liveData.originalApiValue ? 
                        formatOriginalApiPrice(commodity, liveData.originalApiValue) : null;
                      
                      // Graph units (unchanged)
                      const graphUnits = getUnitsByCommodity(commodity, currencyMode, commodity === 'wheat' ? wheatDisplayUnit : null);
                      const graphDecimals = getDecimalsForDisplay(commodity, currencyMode, wheatDisplayUnit);
                      
                      const hasData = liveData.current !== null;
                      const commodityAlerts = priceAlerts.filter(a => a.commodity === commodity);
                      const hasAlerts = commodityAlerts.length > 0;
                      
                      return (
                        <tr key={commodity} style={{ 
                          backgroundColor: rowBg,
                          ...(hasAlerts && { borderLeft: '4px solid #ef4444' })
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
                                  {/* Show original API units */}
                                  {originalUnits}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            fontWeight: '700',
                            color: hasData ? '#374151' : '#9ca3af'
                          }}>
                            {hasData && originalPrice ? (
                              <div>
                                {/* Show original API price */}
                                <div>
                                  {originalPrice.toFixed(originalDecimals)}
                                </div>
                                {/* Show converted price in small text */}
                               
                                <div style={{ 
                                  fontSize: '9px', 
                                  color: '#9ca3af',
                                  marginTop: '2px'
                                }}>
                                  {liveData.lastUpdated}
                                </div>
                              </div>
                            ) : '—'}
                          </td>
                          
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
                              fontSize: '11px'
                            }}>
                              {source === 'api' ? '🌐 API' : 
                               source === 'csv' ? '🌐 API' : '⚠️ None'}
                            </span>
                          </td>
                          
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {hasAlerts ? (
                              <span style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}>
                                ▼ {commodityAlerts.length}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px solid '
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Data Sources</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Real-time DDFPlus API<br/>
              • Historical CSV Fallback<br/>
              • Excel Purchase Records<br/>
              • Dates: 2020-2025<br/>
              • Historical FX Rates
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Key Features</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Automatic CSV fallback<br/>
              • Profit/Loss Analysis<br/>
              • Price drop alerts<br/>
              • Multiple currency modes<br/>
              • Wheat unit conversion<br/>
              • 5-minute live updates
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '88px' }}>API Prices Display</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Wheat: cents/bushel (API)<br/>
              • Palm Oil: MYR/tonne (API)<br/>
              • Aluminum: USD/tonne (API)<br/>
              • Sugar: cents/lb (API)<br/>
              • Brent Crude: USD/barrel (API)<br/>
              • Graph shows converted prices
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommodityDashboard;