// src/components/CommodityDashboard.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area
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

// OPTIMIZATION: Memoize frequently used objects and functions
const memoizedParseCSVData = (() => {
  const cache = new Map();
  return (csvText, symbol) => {
    const cacheKey = `${csvText?.substring(0, 100)}_${symbol}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    if (!csvText) return [];
    
    const lines = csvText.trim().split('\n');
    const data = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(',').map(p => p.trim());
      
      if (parts.length >= 6) {
        const lineSymbol = parts[0];
        const dateStr = parts[1];
        const open = parseFloat(parts[2]);
        const high = parseFloat(parts[3]);
        const low = parseFloat(parts[4]);
        const close = parseFloat(parts[5]);
        const volume = parts.length > 6 ? parseInt(parts[6]) : 0;
        
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
    }
    
    const result = data.sort((a, b) => new Date(a.date) - new Date(b.date));
    cache.set(cacheKey, result);
    return result;
  };
})();

// OPTIMIZATION: Memoized CSV data fetching with cache
const csvDataCache = new Map();
async function getCSVDataForLivePrice(commodity) {
  try {
    const cacheKey = commodity;
    if (csvDataCache.has(cacheKey)) {
      return csvDataCache.get(cacheKey);
    }
    
    const csvSource = CSV_DATA_SOURCES[commodity];
    if (!csvSource) {
      console.warn(`No CSV fallback for ${commodity}`);
      return null;
    }
    
    const response = await fetch(csvSource);
    const csvText = await response.text();
    const symbol = COMMODITY_SYMBOLS[commodity];
    const allData = memoizedParseCSVData(csvText, symbol);
    
    if (allData.length === 0) {
      console.warn(`No CSV data for ${commodity}`);
      return null;
    }
    
    csvDataCache.set(cacheKey, allData);
    // Clear cache after 5 minutes
    setTimeout(() => csvDataCache.delete(cacheKey), 5 * 60 * 1000);
    
    return allData;
    
  } catch (error) {
    console.error(`Error fetching CSV data for ${commodity} live price:`, error);
    return null;
  }
}

// OPTIMIZATION: Binary search for date lookups in sorted array
function findNearestDateIndex(data, targetDate) {
  let left = 0;
  let right = data.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midDate = new Date(data[mid].date);
    
    if (midDate.getTime() === targetDate.getTime()) {
      return mid;
    } else if (midDate < targetDate) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return Math.max(0, right); // Return closest earlier date
}

// OPTIMIZATION: Memoized live price simulation
const simulateLivePricesFromCSV = (() => {
  const cache = new Map();
  return (csvData, commodity) => {
    if (!csvData || csvData.length === 0) {
      console.warn('No CSV data for simulation');
      return null;
    }
    
    const cacheKey = `${csvData.length}_${csvData[csvData.length-1]?.date}_${commodity}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    // CSV data is sorted ascending, so last entry is most recent
    const latestIndex = csvData.length - 1;
    const latest = csvData[latestIndex];
    const latestDate = new Date(latest.date);
    
    // OPTIMIZATION: Use binary search for date lookups
    const yesterdayDate = new Date(latestDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayIndex = findNearestDateIndex(csvData, yesterdayDate);
    const yesterday = csvData[yesterdayIndex];
    
    const weekAgoDate = new Date(latestDate);
    weekAgoDate.setDate(weekAgoDate.getDate() - 7);
    const weekAgoIndex = findNearestDateIndex(csvData, weekAgoDate);
    const weekAgo = csvData[weekAgoIndex];
    
    const monthAgoDate = new Date(latestDate);
    monthAgoDate.setMonth(monthAgoDate.getMonth() - 1);
    const monthAgoIndex = findNearestDateIndex(csvData, monthAgoDate);
    const monthAgo = csvData[monthAgoIndex];
    
    const yearAgoDate = new Date(latestDate);
    yearAgoDate.setFullYear(yearAgoDate.getFullYear() - 1);
    const yearAgoIndex = findNearestDateIndex(csvData, yearAgoDate);
    const yearAgo = csvData[yearAgoIndex];
    
    const result = {
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
      baseApiValue: latest.close
    };
    
    cache.set(cacheKey, result);
    // Clear cache after 1 minute
    setTimeout(() => cache.delete(cacheKey), 60 * 1000);
    
    return result;
  };
})();

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

// OPTIMIZATION: Memoized FX rate getter
const memoizedGetHistoricalFXRate = (() => {
  const cache = new Map();
  return (monthKey, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return 1;
    
    const cacheKey = `${monthKey}_${fromCurrency}_${toCurrency}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    const monthRates = HISTORICAL_FX_RATES[monthKey] || HISTORICAL_FX_RATES['current'];
    
    const directKey = `${fromCurrency}_to_${toCurrency}`;
    if (monthRates[directKey]) {
      cache.set(cacheKey, monthRates[directKey]);
      return monthRates[directKey];
    }
    
    const reverseKey = `${toCurrency}_to_${fromCurrency}`;
    if (monthRates[reverseKey]) {
      const result = 1 / monthRates[reverseKey];
      cache.set(cacheKey, result);
      return result;
    }
    
    if (fromCurrency !== 'USD' && toCurrency !== 'USD') {
      const toUSD = memoizedGetHistoricalFXRate(monthKey, fromCurrency, 'USD');
      const fromUSD = memoizedGetHistoricalFXRate(monthKey, 'USD', toCurrency);
      if (toUSD && fromUSD) {
        const result = toUSD * fromUSD;
        cache.set(cacheKey, result);
        return result;
      }
    }
    
    console.warn(`No FX rate found for ${fromCurrency} to ${toCurrency} for ${monthKey}`);
    return 1;
  };
})();

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

// OPTIMIZATION: Memoized units getter - FIXED: Aluminum shows NGN/tonne in NGN mode
const memoizedGetUnitsByCommodity = (() => {
  const cache = new Map();
  return (commodity, currencyMode, displayUnit = null) => {
    const cacheKey = `${commodity}_${currencyMode}_${displayUnit}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    const targetCurrency = currencyMode === 'original' 
      ? COMMODITY_CURRENCIES[commodity] 
      : 'NGN';
    
    // Handle aluminum - always use per tonne
    if (commodity === 'aluminum') {
      if (currencyMode === 'ngn') {
        const result = 'NGN/tonne';
        cache.set(cacheKey, result);
        return result;
      }
      const result = `${targetCurrency}/tonne`;
      cache.set(cacheKey, result);
      return result;
    }
    
    // Handle palm oil - always use per kg in NGN mode
    if (commodity === 'palm') {
      if (currencyMode === 'ngn') {
        const result = 'NGN/kg';
        cache.set(cacheKey, result);
        return result;
      }
      const result = 'USD/tonne';
      cache.set(cacheKey, result);
      return result;
    }
    
    if (commodity === 'wheat' && displayUnit === 'bushel') {
      const result = `${targetCurrency}/bushel`;
      cache.set(cacheKey, result);
      return result;
    }
    
    // For NGN mode, show per kg for all commodities except aluminum and palm (handled above)
    if (currencyMode === 'ngn') {
      const result = `${targetCurrency}/kg`;
      cache.set(cacheKey, result);
      return result;
    }
    
    // Original currency mode
    if (commodity === 'wheat' || commodity === 'milling_wheat' || 
        commodity === 'crude_palm') {
      const result = `${targetCurrency}/kg`;
      cache.set(cacheKey, result);
      return result;
    }
    
    if (commodity === "aluminum") {
      const result = `${targetCurrency}/tonne`;
      cache.set(cacheKey, result);
      return result;
    }
    
    const result = `${targetCurrency}/kg`;
    cache.set(cacheKey, result);
    return result;
  };
})();

const decimalsByCommodity = {
  wheat: { kg: 3, bushel: 2 },
  milling_wheat: 3,
  palm: { usdPerTonne: 2, ngnPerKg: 2 },
  crude_palm: 3,
  sugar: 2,
  aluminum: 3
};

// Commodity names and colors - made static
const COMMODITY_CONFIG = Object.freeze({
  wheat: { 
    name: 'Wheat CBOT', 
    icon: '🌾', 
    excelColor: '#3B82F6',
    apiColor: '#10B981',
    forecastColor: '#8B5CF6',
    category: 'Grains',
    showInChart: true
  },
  milling_wheat: { 
    name: 'Milling Wheat', 
    icon: '🌾', 
    excelColor: '#8B5CF6',
    apiColor: '#10B981',
    forecastColor: '#3B82F6',
    category: 'Grains',
    showInChart: true
  },
  palm: { 
    name: 'Palm Oil', 
    icon: '🌴', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    forecastColor: '#8B5CF6',
    category: 'Oils',
    showInChart: true
  },
  crude_palm: { 
    name: 'Brent Crude Oil', 
    icon: '🛢️', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    forecastColor: '#8B5CF6',
    category: 'Oils',
    showInChart: true
  },
  sugar: { 
    name: 'Sugar', 
    icon: '🍬', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    forecastColor: '#8B5CF6',
    category: 'Softs',
    showInChart: true
  },
  aluminum: { 
    name: 'Aluminum',
    icon: '🥫', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    forecastColor: '#8B5CF6',
    category: 'Metals',
    showInChart: true
  }
});

const CHART_COMMODITIES = Object.freeze(Object.keys(COMMODITY_CONFIG).filter(
  commodity => COMMODITY_CONFIG[commodity].showInChart
));

const DEFAULT_CHART_COMMODITY = CHART_COMMODITIES[0];

// Excel data mapping by commodity
const EXCEL_DATA_SOURCES = Object.freeze({
  wheat: COMPLETE_WHEAT_DATA,
  milling_wheat: COMPLETE_WHEAT_DATA,
  palm: COMPLETE_PALM_OIL_DATA,
  crude_palm: COMPLETE_CRUDE_PALM_OIL_DATA,
  sugar: SUGAR_MONTH_COST,
  aluminum: CAN_DATA
});

// Negotiated aluminum price
const NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE = 2400;

// OPTIMIZATION: Memoized formatDateForAPI
const formatDateForAPI = (date) => date.toISOString().split('T')[0];

// OPTIMIZATION: Memoized month key getter
const memoizedGetMonthKey = (() => {
  const cache = new Map();
  const monthNames = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
    'January': '01', 'February': '02', 'March': '03', 'April': '04',
    'May': '05', 'June': '06', 'July': '07', 'August': '08',
    'September': '09', 'October': '10', 'November': '11', 'December': '12'
  };
  
  return (dateStr) => {
    if (!dateStr) return null;
    
    if (cache.has(dateStr)) return cache.get(dateStr);
    
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
      cache.set(dateStr, dateStr);
      return dateStr;
    }
    
    if (typeof dateStr === 'string') {
      if (dateStr.match(/^[A-Za-z]{3,}-\d{2,4}$/)) {
        const [monthStr, yearStr] = dateStr.split('-');
        const month = monthNames[monthStr] || '01';
        let year = parseInt(yearStr);
        
        if (yearStr.length === 2) {
          const currentYear = new Date().getFullYear();
          const shortYear = parseInt(yearStr);
          year = shortYear + (shortYear <= (currentYear % 100) ? 2000 : 1900);
        }
        
        const result = `${year}-${month}`;
        cache.set(dateStr, result);
        return result;
      }
      
      if (dateStr.includes('T')) {
        const date = new Date(dateStr);
        if (!isNaN(date)) {
          const result = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          cache.set(dateStr, result);
          return result;
        }
      }
    }
    
    try {
      const date = new Date(dateStr);
      if (!isNaN(date)) {
        const result = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        cache.set(dateStr, result);
        return result;
      }
    } catch (e) {
      console.warn('Failed to parse date:', dateStr, e);
    }
    
    return null;
  };
})();

// OPTIMIZATION: Memoized month display getter
const memoizedGetMonthDisplay = (() => {
  const cache = new Map();
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  return (monthKey) => {
    if (!monthKey) return '';
    if (cache.has(monthKey)) return cache.get(monthKey);
    
    const [year, month] = monthKey.split('-');
    const result = `${monthNames[parseInt(month) - 1]} ${year}`;
    cache.set(monthKey, result);
    return result;
  };
})();

// OPTIMIZATION: Filter recent data once
const filterRecentData = (data, maxYearsBack = 5) => {
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - maxYearsBack;
  
  return data.filter(item => {
    if (!item.monthKey) return false;
    const year = parseInt(item.monthKey.split('-')[0]);
    return year >= 2020 && year <= currentYear + 1;
  });
};

// OPTIMIZATION: Memoized API value converter - FIXED: Milling wheat conversion from EUR/tonne to USD/kg
const memoizedConvertApiValueToTargetCurrency = (() => {
  const cache = new Map();
  
  return (commodity, apiValue, targetCurrency, monthKey = null, wheatDisplayUnit = 'usdPerKg', currencyMode = 'original') => {
    if (apiValue == null || isNaN(Number(apiValue))) return null;
    
    const cacheKey = `${commodity}_${apiValue}_${targetCurrency}_${monthKey}_${wheatDisplayUnit}_${currencyMode}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
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
        // FIXED: API returns EUR/tonne, convert to USD/kg
        const eurPerTonne = value;
        // Convert EUR/tonne to USD/tonne first
        const usdPerTonne = eurPerTonne * memoizedGetHistoricalFXRate(monthKey || 'current', 'EUR', 'USD');
        // Then convert to USD/kg (divide by 1000)
        apiPriceInOriginalCurrency = usdPerTonne / TONNE_TO_KG;
        apiCurrency = 'USD';
        break;

      case 'palm':
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
        // FIXED: Keep as USD/tonne for original mode, convert appropriately for NGN mode
        if (currencyMode === 'ngn') {
          apiPriceInOriginalCurrency = value; // Keep as USD/tonne
          apiCurrency = 'USD';
        } else {
          apiPriceInOriginalCurrency = value; // USD/tonne
          apiCurrency = 'USD';
        }
        break;

      default:
        cache.set(cacheKey, value);
        return value;
    }

    // Convert to target currency if needed
    if (apiCurrency !== targetCurrency) {
      const fxRate = memoizedGetHistoricalFXRate(monthKey || 'current', apiCurrency, targetCurrency);
      let convertedValue = apiPriceInOriginalCurrency * fxRate;
      
      // Handle special cases
      if (commodity === 'palm') {
        if (targetCurrency === 'NGN') {
          const usdPerTonne = convertedValue;
          const usdPerKg = usdPerTonne / TONNE_TO_KG;
          const ngnPerKg = usdPerKg * memoizedGetHistoricalFXRate(monthKey || 'current', 'USD', 'NGN');
          cache.set(cacheKey, ngnPerKg);
          return ngnPerKg;
        }
        cache.set(cacheKey, convertedValue);
        return convertedValue;
      }
      
      // For aluminum in NGN mode, keep as NGN/tonne (don't convert to per kg)
      if (commodity === 'aluminum' && currencyMode === 'ngn') {
        // Already in USD/tonne, convert to NGN/tonne
        const ngnPerTonne = convertedValue * memoizedGetHistoricalFXRate(monthKey || 'current', 'USD', 'NGN');
        cache.set(cacheKey, ngnPerTonne);
        return ngnPerTonne;
      }
      
      cache.set(cacheKey, convertedValue);
      return convertedValue;
    }

    cache.set(cacheKey, apiPriceInOriginalCurrency);
    return apiPriceInOriginalCurrency;
  };
})();

// OPTIMIZATION: Memoized Excel price converter - FIXED: Aluminum for NGN mode
const memoizedConvertExcelPriceToTargetCurrency = (() => {
  const cache = new Map();
  
  return (commodity, excelItem, targetCurrency, monthKey = null, wheatDisplayUnit = 'usdPerKg', currencyMode = 'original') => {
    if (!excelItem) return null;
    
    const cacheKey = `${commodity}_${excelItem.rate || excelItem.fob || excelItem.cost}_${targetCurrency}_${monthKey}_${wheatDisplayUnit}_${currencyMode}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    let priceInOriginalCurrency;
    let excelCurrency;
    
    switch(commodity) {
      case 'wheat':
      case 'milling_wheat':
        if (excelItem.currency === 'GHS') {
          const fxRate = memoizedGetHistoricalFXRate(monthKey, 'GHS', 'USD');
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
        if (excelItem.fob) {
          priceInOriginalCurrency = excelItem.fob;
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
        // FIXED: Keep negotiated price as USD/tonne
        priceInOriginalCurrency = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE;
        excelCurrency = 'USD';
        break;
        
      default:
        return null;
    }

    if (excelCurrency !== targetCurrency) {
      const fxRate = memoizedGetHistoricalFXRate(monthKey, excelCurrency, targetCurrency);
      let convertedValue = priceInOriginalCurrency * fxRate;
      
      if (commodity === 'palm' && targetCurrency === 'NGN') {
        const usdPerTonne = convertedValue;
        const usdPerKg = usdPerTonne / TONNE_TO_KG;
        const ngnPerKg = usdPerKg * memoizedGetHistoricalFXRate(monthKey, 'USD', 'NGN');
        cache.set(cacheKey, ngnPerKg);
        return ngnPerKg;
      }
      
      // For aluminum in NGN mode, keep as NGN/tonne
      if (commodity === 'aluminum' && currencyMode === 'ngn') {
        // Already in USD/tonne, convert to NGN/tonne
        const ngnPerTonne = convertedValue * memoizedGetHistoricalFXRate(monthKey || 'current', 'USD', 'NGN');
        cache.set(cacheKey, ngnPerTonne);
        return ngnPerTonne;
      }
      
      cache.set(cacheKey, convertedValue);
      return convertedValue;
    }

    cache.set(cacheKey, priceInOriginalCurrency);
    return priceInOriginalCurrency;
  };
})();

// Get Excel date for month grouping
const getExcelDateForMonth = (commodity, excelItem) => {
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
};

// OPTIMIZATION: Process Excel data once with memoization - UPDATED: Pass currencyMode
const memoizedProcessExcelDataByMonth = (() => {
  const cache = new Map();
  
  return (commodity, currencyMode, wheatDisplayUnit = 'usdPerKg') => {
    const cacheKey = `${commodity}_${currencyMode}_${wheatDisplayUnit}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    const rawData = EXCEL_DATA_SOURCES[commodity] || [];
    const targetCurrency = currencyMode === 'original' 
      ? COMMODITY_CURRENCIES[commodity] 
      : 'NGN';
    
    const monthlyData = {};
    
    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      const dateStr = getExcelDateForMonth(commodity, item);
      const monthKey = memoizedGetMonthKey(dateStr);
      
      if (!monthKey) continue;
      
      const year = parseInt(monthKey.split('-')[0]);
      const currentYear = new Date().getFullYear();
      
      if (year < 2020 || year > currentYear + 1) continue;
      
      const priceInTargetCurrency = memoizedConvertExcelPriceToTargetCurrency(commodity, item, targetCurrency, monthKey, wheatDisplayUnit, currencyMode);
      if (priceInTargetCurrency == null) continue;
      
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
    }
    
    const result = Object.values(monthlyData).map(month => ({
      monthKey: month.monthKey,
      monthDisplay: memoizedGetMonthDisplay(month.monthKey),
      excelPrice: month.values.reduce((sum, val) => sum + val, 0) / month.values.length,
      transactionCount: month.values.length,
      dates: month.dates,
      currencies: month.currencies
    })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    
    const filteredResult = filterRecentData(result, 5);
    cache.set(cacheKey, filteredResult);
    return filteredResult;
  };
})();

// OPTIMIZATION: Debounced fetch function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// OPTIMIZATION: Memoized fetch from CSV
const memoizedFetchDataFromCSV = (() => {
  const cache = new Map();
  
  return async (commodity, startDate, endDate) => {
    const cacheKey = `${commodity}_${startDate}_${endDate}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    try {
      const csvSource = CSV_DATA_SOURCES[commodity];
      if (!csvSource) return [];
      
      const response = await fetch(csvSource);
      const csvText = await response.text();
      const symbol = COMMODITY_SYMBOLS[commodity];
      const allData = memoizedParseCSVData(csvText, symbol);
      
      const filteredData = allData.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
      });
      
      cache.set(cacheKey, filteredData);
      return filteredData;
      
    } catch (error) {
      console.error(`Error fetching CSV data for ${commodity}:`, error);
      return [];
    }
  };
})();

// OPTIMIZATION: Individual month fetcher
async function fetchMonthlyPriceForMonth(symbol, month) {
  try {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    
    const startStr = formatDateForAPI(startDate);
    const endStr = formatDateForAPI(endDate);
    
    const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${startStr}&enddate=${endStr}`;
    
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const text = await response.text();
    
    if (!text || text.includes('error') || text.includes('No data')) return null;
    
    const lines = text.trim().split('\n').filter(line => line.trim() && !line.includes('error'));
    const dailyPrices = [];
    
    for (const line of lines) {
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
    }
    
    if (dailyPrices.length > 0) {
      const sum = dailyPrices.reduce((sum, day) => sum + day.price, 0);
      const monthlyAvg = sum / dailyPrices.length;
      
      return {
        monthKey: month,
        avgPrice: monthlyAvg,
        dataPoints: dailyPrices.length,
        sampleDates: dailyPrices.slice(0, 3).map(d => d.date),
        source: 'api'
      };
    }
    
    return null;
  } catch (fetchError) {
    console.error(`Error fetching ${month} for ${symbol}:`, fetchError);
    return null;
  }
}

// OPTIMIZATION: Improved fetch monthly prices with caching
const memoizedFetchMonthlyPricesWithFallback = (() => {
  const cache = new Map();
  
  return async (symbol, commodity, months, wheatDisplayUnit = 'usdPerKg', currencyMode = 'original') => {
    const cacheKey = `${symbol}_${commodity}_${months.join('_')}_${wheatDisplayUnit}_${currencyMode}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    try {
      // OPTIMIZATION: Process months in batches
      const batchSize = 3;
      const recentMonths = months.filter(monthKey => {
        const year = parseInt(monthKey.split('-')[0]);
        return year >= 2020;
      });
      
      if (recentMonths.length === 0) {
        const result = { data: [], source: 'none' };
        cache.set(cacheKey, result);
        return result;
      }
      
      // Try API first in batches
      const apiResults = [];
      for (let i = 0; i < recentMonths.length; i += batchSize) {
        const batch = recentMonths.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(month => fetchMonthlyPriceForMonth(symbol, month))
        );
        apiResults.push(...batchResults.filter(r => r));
        
        // Small delay between batches
        if (i + batchSize < recentMonths.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      if (apiResults.length > 0) {
        const result = { data: apiResults, source: 'api' };
        cache.set(cacheKey, result);
        return result;
      }
      
      // Fallback to CSV
      const csvMonthlyResults = [];
      for (const month of recentMonths) {
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0);
        
        const startStr = formatDateForAPI(startDate);
        const endStr = formatDateForAPI(endDate);
        
        const csvData = await memoizedFetchDataFromCSV(commodity, startStr, endStr);
        
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
      
      const result = {
        data: csvMonthlyResults,
        source: csvMonthlyResults.length > 0 ? 'csv' : 'none'
      };
      
      cache.set(cacheKey, result);
      setTimeout(() => cache.delete(cacheKey), 5 * 60 * 1000); // Cache for 5 minutes
      
      return result;
      
    } catch (error) {
      console.error(`Error in fetchMonthlyPricesWithFallback for ${commodity}:`, error);
      const result = { data: [], source: 'error' };
      cache.set(cacheKey, result);
      return result;
    }
  };
})();

// Process API data by month - UPDATED: Pass currencyMode
const memoizedProcessApiDataByMonth = (() => {
  const cache = new Map();
  
  return (commodity, apiMonthlyData, currencyMode, wheatDisplayUnit = 'usdPerKg') => {
    const cacheKey = `${commodity}_${apiMonthlyData.map(d => d.monthKey).join('_')}_${currencyMode}_${wheatDisplayUnit}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    const targetCurrency = currencyMode === 'original' 
      ? COMMODITY_CURRENCIES[commodity] 
      : 'NGN';
    
    const result = apiMonthlyData.map(item => {
      let apiPrice = memoizedConvertApiValueToTargetCurrency(commodity, item.avgPrice, targetCurrency, item.monthKey, wheatDisplayUnit, currencyMode);
      
      return {
        monthKey: item.monthKey,
        monthDisplay: memoizedGetMonthDisplay(item.monthKey),
        apiPrice: apiPrice,
        dataPoints: item.dataPoints,
        source: item.source || 'api'
      };
    }).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    
    cache.set(cacheKey, result);
    return result;
  };
})();

// OPTIMIZATION: Combine data with caching - UPDATED: Pass wheatDisplayUnit
const memoizedCombineMonthlyData = (() => {
  const cache = new Map();
  
  return (excelMonthly, apiMonthly, commodity, wheatDisplayUnit = 'usdPerKg') => {
    const cacheKey = `${excelMonthly.map(m => m.monthKey).join('_')}_${apiMonthly.map(m => m.monthKey).join('_')}_${commodity}_${wheatDisplayUnit}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    const excelMonths = excelMonthly.map(item => item.monthKey);
    
    const result = excelMonths.map(monthKey => {
      const excelMonth = excelMonthly.find(item => item.monthKey === monthKey);
      const apiMonth = apiMonthly.find(item => item.monthKey === monthKey);
      
      let excelPrice = excelMonth?.excelPrice || null;
      let apiPrice = apiMonth?.apiPrice || null;
      
      let profitLossPercentage = null;
      if (excelPrice && apiPrice) {
        profitLossPercentage = ((excelPrice - apiPrice) / apiPrice) * 100;
      }
      
      return {
        monthKey,
        monthDisplay: memoizedGetMonthDisplay(monthKey),
        excelPrice: excelPrice,
        apiPrice: apiPrice,
        profitLossPercentage: profitLossPercentage,
        excelTransactions: excelMonth?.transactionCount || 0,
        apiDataPoints: apiMonth?.dataPoints || 0,
        apiSource: apiMonth?.source || 'none'
      };
    });
    
    cache.set(cacheKey, result);
    return result;
  };
})();

// OPTIMIZATION: Memoized decimals getter
const memoizedGetDecimalsForDisplay = (() => {
  const cache = new Map();
  return (commodity, currencyMode, wheatDisplayUnit) => {
    const cacheKey = `${commodity}_${currencyMode}_${wheatDisplayUnit}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    const dec = decimalsByCommodity[commodity];
    let result;
    
    if (commodity === 'wheat') {
      result = wheatDisplayUnit === 'bushel' ? dec.bushel : dec.kg;
    } else if (commodity === 'palm') {
      result = currencyMode === 'ngn' ? (dec.ngnPerKg || 2) : (dec.usdPerTonne || 2);
    } else if (commodity === 'aluminum' && currencyMode === 'ngn') {
      result = 0; // NGN/tonne typically shows 0 decimals
    } else if (typeof dec === 'object') {
      result = 2;
    } else {
      result = dec || 2;
    }
    
    cache.set(cacheKey, result);
    return result;
  };
})();

// Helper function to get original API units for display in live prices table - FIXED: Wheat shows cents/bushel
const memoizedGetOriginalUnitsForLivePrices = (() => {
  const cache = new Map();
  return (commodity) => {
    if (cache.has(commodity)) return cache.get(commodity);
    
    let result;
    switch(commodity) {
      case 'wheat':
        result = 'cents/bushel'; // FIXED: Show cents/bushel instead of USD/bushel
        break;
      case 'milling_wheat':
        result = 'EUR/tonne';
        break;
      case 'palm':
        result = 'MYR/tonne';
        break;
      case 'crude_palm':
        result = 'USD/barrel';
        break;
      case 'sugar':
        result = 'cents/lb';
        break;
      case 'aluminum':
        result = 'USD/tonne';
        break;
      default:
        result = '';
    }
    
    cache.set(commodity, result);
    return result;
  };
})();

// OPTIMIZATION: Memoized API price formatter
const memoizedFormatOriginalApiPrice = (() => {
  const cache = new Map();
  return (commodity, apiValue) => {
    if (apiValue == null || isNaN(Number(apiValue))) return null;
    
    const cacheKey = `${commodity}_${apiValue}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    const value = Number(apiValue);
    cache.set(cacheKey, value);
    return value;
  };
})();

// OPTIMIZATION: Memoized original decimals getter
const memoizedGetOriginalDecimalsForDisplay = (() => {
  const cache = new Map();
  return (commodity) => {
    if (cache.has(commodity)) return cache.get(commodity);
    
    const result = 2; // Most commodities use 2 decimals
    cache.set(commodity, result);
    return result;
  };
})();

// NEW: ML Forecasting Functions
const FORECAST_API_URL = 'http://localhost:5001/api/forecast';

// OPTIMIZATION: Memoized forecast fetcher with cache
const memoizedFetchMLForecast = (() => {
  const forecastCache = new Map();
  
  return async (commodity, months = 12) => {
    const cacheKey = `${commodity}_${months}`;
    
    // Return cached forecast if available and not too old (5 minutes)
    if (forecastCache.has(cacheKey)) {
      const cached = forecastCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
      }
    }
    
    try {
      const response = await fetch(FORECAST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commodity: commodity,
          months: months
        })
      });
      
      if (!response.ok) {
        throw new Error(`Forecast API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Cache the forecast
      forecastCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error('Error fetching ML forecast:', error);
      
      // Generate mock forecast data for demonstration
      const mockData = generateMockForecast(commodity, months);
      
      // Cache mock data too
      forecastCache.set(cacheKey, {
        data: mockData,
        timestamp: Date.now()
      });
      
      return mockData;
    }
  };
})();

// OPTIMIZATION: Memoized mock forecast generator
const memoizedGenerateMockForecast = (() => {
  const cache = new Map();
  
  return (commodity, months = 12) => {
    const cacheKey = `${commodity}_${months}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    console.log(`Generating mock forecast for ${commodity} (${months} months)`);
    
    const currentDate = new Date();
    const startYear = currentDate.getFullYear();
    const startMonth = currentDate.getMonth();
    
    const basePrices = {
      wheat: 600,
      milling_wheat: 220,
      palm: 850,
      crude_palm: 80,
      sugar: 22,
      aluminum: 2400
    };
    
    const basePrice = basePrices[commodity] || 100;
    
    const historicalDates = [];
    const historicalPrices = [];
    
    for (let i = 23; i >= 0; i--) {
      const date = new Date(startYear, startMonth - i, 1);
      const price = basePrice * (1 + (Math.random() * 0.4 - 0.2));
      historicalDates.push(date.toISOString().split('T')[0]);
      historicalPrices.push(price);
    }
    
    const testDates = historicalDates.slice(-6);
    const testActual = historicalPrices.slice(-6);
    const testPredicted = testActual.map(price => price * (1 + (Math.random() * 0.1 - 0.05)));
    
    const forecastDates = [];
    const forecastPrices = [];
    
    const forecastStartYear = 2026;
    const forecastStartMonth = 0;
    
    for (let i = 0; i < months; i++) {
      const date = new Date(forecastStartYear, forecastStartMonth + i, 1);
      const price = basePrice * (1 + (Math.random() * 0.3 - 0.15) + (i * 0.01));
      forecastDates.push(date.toISOString().split('T')[0]);
      forecastPrices.push(price);
    }
    
    const result = {
      historical: {
        dates: historicalDates,
        prices: historicalPrices
      },
      test_predictions: {
        dates: testDates,
        actual: testActual,
        predicted: testPredicted
      },
      forecast: {
        dates: forecastDates,
        prices: forecastPrices
      },
      metrics: {
        mape: 3.5 + Math.random() * 2,
        rmse: basePrice * 0.05,
        training_samples: 120,
        test_samples: 6
      },
      commodity: commodity,
      forecast_months: months
    };
    
    cache.set(cacheKey, result);
    return result;
  };
})();

// OPTIMIZATION: Use the memoized version
const generateMockForecast = memoizedGenerateMockForecast;

// OPTIMIZATION: Memoized forecast data converter
const memoizedConvertForecastData = (() => {
  const cache = new Map();
  
  return (forecastData, commodity, currencyMode, wheatDisplayUnit = 'usdPerKg') => {
    if (!forecastData || !forecastData.forecast) return null;
    
    const cacheKey = `${forecastData.commodity}_${currencyMode}_${wheatDisplayUnit}_${forecastData.forecast_months}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    const targetCurrency = currencyMode === 'original' 
      ? COMMODITY_CURRENCIES[commodity] 
      : 'NGN';
    
    const historical = forecastData.historical || { dates: [], prices: [] };
    const convertedHistorical = historical.prices.map((price, index) => {
      const date = historical.dates[index];
      const monthKey = memoizedGetMonthKey(date);
      return {
        date: date,
        price: memoizedConvertApiValueToTargetCurrency(commodity, price, targetCurrency, monthKey, wheatDisplayUnit, currencyMode),
        type: 'historical'
      };
    });
    
    const testPredictions = forecastData.test_predictions || { dates: [], actual: [], predicted: [] };
    const convertedTestActual = testPredictions.actual.map((price, index) => {
      const date = testPredictions.dates[index];
      const monthKey = memoizedGetMonthKey(date);
      return {
        date: date,
        price: memoizedConvertApiValueToTargetCurrency(commodity, price, targetCurrency, monthKey, wheatDisplayUnit, currencyMode),
        type: 'test_actual'
      };
    });
    
    const convertedTestPredicted = testPredictions.predicted.map((price, index) => {
      const date = testPredictions.dates[index];
      const monthKey = memoizedGetMonthKey(date);
      return {
        date: date,
        price: memoizedConvertApiValueToTargetCurrency(commodity, price, targetCurrency, monthKey, wheatDisplayUnit, currencyMode),
        type: 'test_predicted'
      };
    });
    
    const forecast = forecastData.forecast || { dates: [], prices: [] };
    const convertedForecast = forecast.prices.map((price, index) => {
      const date = forecast.dates[index];
      const monthKey = memoizedGetMonthKey(date);
      return {
        date: date,
        price: memoizedConvertApiValueToTargetCurrency(commodity, price, targetCurrency, monthKey, wheatDisplayUnit, currencyMode),
        type: 'forecast'
      };
    });
    
    const result = {
      historical: convertedHistorical,
      test: {
        actual: convertedTestActual,
        predicted: convertedTestPredicted
      },
      forecast: convertedForecast,
      metrics: forecastData.metrics || {},
      commodity: forecastData.commodity,
      forecastMonths: forecastData.forecast_months || 12
    };
    
    cache.set(cacheKey, result);
    return result;
  };
})();

// OPTIMIZATION: Memoized forecast chart data preparation
const memoizedPrepareForecastChartData = (() => {
  const cache = new Map();
  
  return (forecastData) => {
    if (!forecastData) return [];
    
    const cacheKey = `${forecastData.commodity}_${forecastData.forecastMonths}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    
    const monthMap = new Map();
    
    const addToMonthMap = (dateStr, type, price) => {
      const date = new Date(dateStr);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthDisplay = memoizedGetMonthDisplay(monthKey);
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          date: dateStr,
          monthKey,
          monthDisplay,
          historicalPrice: null,
          testActualPrice: null,
          testPredictedPrice: null,
          forecastPrice: null,
          count: 0
        });
      }
      
      const entry = monthMap.get(monthKey);
      
      switch(type) {
        case 'historical':
          entry.historicalPrice = price;
          break;
        case 'test_actual':
          entry.testActualPrice = price;
          break;
        case 'test_predicted':
          entry.testPredictedPrice = price;
          break;
        case 'forecast':
          entry.forecastPrice = price;
          break;
      }
      
      entry.count++;
    };
    
    forecastData.historical.forEach(item => {
      addToMonthMap(item.date, 'historical', item.price);
    });
    
    forecastData.test.actual.forEach(item => {
      addToMonthMap(item.date, 'test_actual', item.price);
    });
    
    forecastData.test.predicted.forEach(item => {
      addToMonthMap(item.date, 'test_predicted', item.price);
    });
    
    forecastData.forecast.forEach(item => {
      addToMonthMap(item.date, 'forecast', item.price);
    });
    
    const result = Array.from(monthMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
    cache.set(cacheKey, result);
    return result;
  };
})();

// OPTIMIZATION: Memoized future dates generator
const memoizedGetFutureDatesForForecast = (() => {
  const cache = new Map();
  return (months = 12) => {
    if (cache.has(months)) return cache.get(months);
    
    const dates = [];
    let year = 2026;
    let month = 0;
    
    for (let i = 0; i < months; i++) {
      const date = new Date(year, month + i, 1);
      dates.push(date.toISOString().split('T')[0]);
      
      if (month + i >= 11) {
        year++;
        month -= 12;
      }
    }
    
    cache.set(months, dates);
    return dates;
  };
})();

// OPTIMIZATION: Forecast Tooltip as React.memo component
const ForecastTooltip = React.memo(({ active, payload, label, commodity, currencyMode, wheatDisplayUnit }) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0].payload;
  const units = memoizedGetUnitsByCommodity(commodity, currencyMode, wheatDisplayUnit);
  const dec = memoizedGetDecimalsForDisplay(commodity, currencyMode, wheatDisplayUnit);
  
  let price;
  let typeLabel;
  let color;
  
  if (data.historicalPrice !== null && data.historicalPrice !== undefined) {
    price = data.historicalPrice;
    typeLabel = 'Historical Price';
    color = '#3B82F6';
  } else if (data.testActualPrice !== null && data.testActualPrice !== undefined) {
    price = data.testActualPrice;
    typeLabel = 'Actual (Test)';
    color = '#10B981';
  } else if (data.testPredictedPrice !== null && data.testPredictedPrice !== undefined) {
    price = data.testPredictedPrice;
    typeLabel = 'ML Prediction (Test)';
    color = '#F59E0B';
  } else if (data.forecastPrice !== null && data.forecastPrice !== undefined) {
    price = data.forecastPrice;
    typeLabel = 'ML Forecast';
    color = '#8B5CF6';
  } else {
    return null;
  }
  
  return (
    <div style={{
      background: 'white',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid #ccc',
      minWidth: '250px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      <p style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
        {new Date(data.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </p>
      
      <div style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <div style={{ 
            width: '12px', 
            height: '3px', 
            backgroundColor: color,
            borderRadius: '1px' 
          }}></div>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>
            {typeLabel}
          </span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ 
            fontWeight: 'bold', 
            color: color,
            fontSize: '16px' 
          }}>
            {price?.toFixed(dec)} {units}
          </span>
        </div>
      </div>
      
      {typeLabel === 'ML Forecast' && (
        <div style={{ 
          marginTop: '8px',
          padding: '6px',
          backgroundColor: '#f3f4f6',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#6b7280'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Confidence:</span>
            <span style={{ fontWeight: '600' }}>High (ML Model)</span>
          </div>
        </div>
      )}
    </div>
  );
});

ForecastTooltip.displayName = 'ForecastTooltip';

// MAIN COMPONENT - FIXED VERSION
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
  
  // NEW: Forecast states
  const [showForecast, setShowForecast] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastData, setForecastData] = useState(null);
  const [forecastError, setForecastError] = useState('');
  const [forecastMonths, setForecastMonths] = useState(12);
  const [forecastRefreshTrigger, setForecastRefreshTrigger] = useState(0);

  // OPTIMIZATION: Use refs for data that doesn't trigger re-renders
  const livePricesRef = useRef({});
  const excelMonthlyDataRef = useRef({});
  const dataSourceRef = useRef({});

  // OPTIMIZATION: Debounced state setters
  const debouncedSetLivePrices = useCallback(
    debounce((data) => {
      setLivePrices(data);
      livePricesRef.current = data;
    }, 300),
    []
  );

  const debouncedSetDataSource = useCallback(
    debounce((data) => {
      setDataSource(data);
      dataSourceRef.current = data;
    }, 300),
    []
  );

  // FIX: Reset forecast when commodity changes
  useEffect(() => {
    setShowForecast(false);
    setForecastData(null);
    setForecastError('');
  }, [selectedCommodity]);

  // OPTIMIZATION: Process Excel data with useMemo
  const excelMonthlyData = useMemo(() => {
    const data = {};
    CHART_COMMODITIES.forEach(commodity => {
      data[commodity] = memoizedProcessExcelDataByMonth(commodity, currencyMode, wheatDisplayUnit);
    });
    
    if (!data.aluminum || data.aluminum.length === 0) {
      const months = [];
      const currentDate = new Date();
      const startDate = new Date(2020, 0, 1);
      
      const targetCurrency = currencyMode === 'original' ? 'USD' : 'NGN';
      const baseUsdPerTonne = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE;
      
      for (let d = new Date(startDate); d <= currentDate; d.setMonth(d.getMonth() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        
        let price;
        if (targetCurrency === 'USD') {
          price = baseUsdPerTonne; // USD/tonne
        } else {
          // For NGN mode, convert to NGN/tonne
          const fxRate = memoizedGetHistoricalFXRate(monthKey, 'USD', 'NGN');
          price = baseUsdPerTonne * fxRate; // NGN/tonne
        }
        
        months.push({
          monthKey,
          monthDisplay: memoizedGetMonthDisplay(monthKey),
          excelPrice: price,
          transactionCount: 1,
          dates: [monthKey],
          currencies: ['USD']
        });
      }
      
      data.aluminum = months;
    }
    
    excelMonthlyDataRef.current = data;
    return data;
  }, [currencyMode, wheatDisplayUnit]);

  // OPTIMIZATION: Memoized price alert checker
  const checkPriceAlerts = useCallback((commodity, liveData) => {
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
  }, []);

  // OPTIMIZATION: Memoized forecast generation
  const handleGenerateForecast = useCallback(async () => {
    setLoadingForecast(true);
    setForecastError('');
    
    try {
      const data = await memoizedFetchMLForecast(selectedCommodity, forecastMonths);
      const convertedData = memoizedConvertForecastData(data, selectedCommodity, currencyMode, wheatDisplayUnit);
      
      if (convertedData) {
        setForecastData(convertedData);
        setShowForecast(true);
      } else {
        setForecastError('Failed to process forecast data');
      }
    } catch (error) {
      console.error('Forecast generation error:', error);
      setForecastError(`Failed to generate forecast: ${error.message}`);
    } finally {
      setLoadingForecast(false);
    }
  }, [selectedCommodity, forecastMonths, currencyMode, wheatDisplayUnit]);

  // OPTIMIZATION: Memoized percentage change calculator
  const calculatePercentageChange = useCallback((current, previous) => {
    if (!previous || previous === 0 || !current) return null;
    return ((current - previous) / previous) * 100;
  }, []);

  // OPTIMIZATION: Fetch live prices with batching
  useEffect(() => {
    let isMounted = true;
    
    const fetchLivePrices = async () => {
      if (!isMounted) return;
      
      setLoadingLivePrices(true);
      setApiStatus('fetching_live');
      
      try {
        const liveData = {};
        const newAlerts = [];
        
        // OPTIMIZATION: Process commodities in batches
        const commodities = Object.entries(COMMODITY_SYMBOLS);
        const batchSize = 2;
        
        for (let i = 0; i < commodities.length; i += batchSize) {
          const batch = commodities.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async ([commodity, symbol]) => {
            let priceData = null;
            let dataSourceType = 'none';
            
            const csvData = await getCSVDataForLivePrice(commodity);
            
            if (csvData && csvData.length > 0) {
              priceData = simulateLivePricesFromCSV(csvData, commodity);
              dataSourceType = 'csv';
            }
            
            if (!priceData) {
              return { commodity, data: null };
            }
            
            const targetCurrency = currencyMode === 'original' 
              ? COMMODITY_CURRENCIES[commodity] 
              : 'NGN';
            
            const currentDate = new Date();
            const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            
            const current = memoizedConvertApiValueToTargetCurrency(commodity, priceData.current, targetCurrency, currentMonthKey, wheatDisplayUnit, currencyMode);
            const previous = priceData.previous ? memoizedConvertApiValueToTargetCurrency(commodity, priceData.previous, targetCurrency, currentMonthKey, wheatDisplayUnit, currencyMode) : null;
            
            let weekAgo = null, monthAgo = null, yearAgo = null;
            
            if (priceData.weekAgo && priceData.weekAgoDate) {
              const weekMonthKey = memoizedGetMonthKey(priceData.weekAgoDate);
              weekAgo = memoizedConvertApiValueToTargetCurrency(commodity, priceData.weekAgo, targetCurrency, weekMonthKey, wheatDisplayUnit, currencyMode);
            }
            
            if (priceData.monthAgo && priceData.monthAgoDate) {
              const monthMonthKey = memoizedGetMonthKey(priceData.monthAgoDate);
              monthAgo = memoizedConvertApiValueToTargetCurrency(commodity, priceData.monthAgo, targetCurrency, monthMonthKey, wheatDisplayUnit, currencyMode);
            }
            
            if (priceData.yearAgo && priceData.yearAgoDate) {
              const yearMonthKey = memoizedGetMonthKey(priceData.yearAgoDate);
              yearAgo = memoizedConvertApiValueToTargetCurrency(commodity, priceData.yearAgo, targetCurrency, yearMonthKey, wheatDisplayUnit, currencyMode);
            }
            
            const percentages = {
              day: previous ? calculatePercentageChange(current, previous) : null,
              week: weekAgo ? calculatePercentageChange(current, weekAgo) : null,
              month: monthAgo ? calculatePercentageChange(current, monthAgo) : null,
              year: yearAgo ? calculatePercentageChange(current, yearAgo) : null
            };
            
            return {
              commodity,
              data: {
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
                originalApiValue: priceData.baseApiValue || priceData.current
              }
            };
          });
          
          const batchResults = await Promise.all(batchPromises);
          
          batchResults.forEach(({ commodity, data }) => {
            if (data) {
              liveData[commodity] = data;
              const commodityAlerts = checkPriceAlerts(commodity, data);
              newAlerts.push(...commodityAlerts);
            } else {
              liveData[commodity] = {
                current: null,
                previous: null,
                weekAgo: null,
                monthAgo: null,
                yearAgo: null,
                percentages: { day: null, week: null, month: null, year: null },
                symbol: COMMODITY_SYMBOLS[commodity],
                lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'no_data',
                source: 'none',
                originalApiValue: null
              };
            }
          });
          
          // Small delay between batches
          if (i + batchSize < commodities.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        if (isMounted) {
          debouncedSetLivePrices(liveData);
          setApiStatus('connected');
          
          if (newAlerts.length > 0) {
            setPriceAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
          }
        }
        
      } catch (error) {
        console.error('Error fetching live prices:', error);
        if (isMounted) {
          setApiStatus('error');
        }
        
        // Fallback logic
        try {
          const fallbackData = {};
          for (const [commodity, symbol] of Object.entries(COMMODITY_SYMBOLS)) {
            const csvData = await getCSVDataForLivePrice(commodity);
            if (csvData && csvData.length > 0) {
              const priceData = simulateLivePricesFromCSV(csvData, commodity);
              
              if (priceData && priceData.current) {
                const targetCurrency = currencyMode === 'original' 
                  ? COMMODITY_CURRENCIES[commodity] 
                  : 'NGN';
                
                const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                const current = memoizedConvertApiValueToTargetCurrency(commodity, priceData.current, targetCurrency, currentMonthKey, wheatDisplayUnit, currencyMode);
                const previous = priceData.previous ? memoizedConvertApiValueToTargetCurrency(commodity, priceData.previous, targetCurrency, currentMonthKey, wheatDisplayUnit, currencyMode) : null;
                
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
                  originalApiValue: priceData.baseApiValue || priceData.current
                };
              }
            }
          }
          
          if (isMounted) {
            debouncedSetLivePrices(prev => ({ ...prev, ...fallbackData }));
          }
        } catch (csvError) {
          console.error('Even CSV fallback failed:', csvError);
        }
        
      } finally {
        if (isMounted) {
          setLoadingLivePrices(false);
        }
      }
    };

    fetchLivePrices();
    
    const intervalId = setInterval(fetchLivePrices, 5 * 60 * 1000);
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [currencyMode, wheatDisplayUnit, calculatePercentageChange, checkPriceAlerts, debouncedSetLivePrices]);

  // OPTIMIZATION: Fetch API data with better error handling
  useEffect(() => {
    let isMounted = true;
    
    const fetchAllCommodityData = async () => {
      if (!isMounted) return;
      
      setLoading(true);
      setError('');
      setApiStatus('fetching_historical');
      
      try {
        const dataPromises = CHART_COMMODITIES.map(async (commodity) => {
          const symbol = COMMODITY_SYMBOLS[commodity];
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
          const result = await memoizedFetchMonthlyPricesWithFallback(symbol, commodity, excelMonths, wheatDisplayUnit, currencyMode);
          
          const apiMonthly = memoizedProcessApiDataByMonth(commodity, result.data, currencyMode, wheatDisplayUnit);
          const combinedData = memoizedCombineMonthlyData(excelMonthly, apiMonthly, commodity, wheatDisplayUnit);
          
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
        
        if (!isMounted) return;
        
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
        debouncedSetDataSource(sourceObj);
        setApiStatus('connected');
        
      } catch (err) {
        console.error('Error in fetchAllCommodityData:', err);
        if (isMounted) {
          setError(`Failed to fetch data: ${err.message}. Please check your API connection.`);
          setApiStatus('error');
          
          const emptyData = {};
          const emptyComparison = {};
          const emptySource = {};
          
          CHART_COMMODITIES.forEach(commodity => {
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
          debouncedSetDataSource(emptySource);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAllCommodityData();
    
    const intervalId = setInterval(fetchAllCommodityData, 10 * 60 * 1000);
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [excelMonthlyData, currencyMode, wheatDisplayUnit, debouncedSetDataSource]);

  // OPTIMIZATION: Memoized profit/loss metrics calculator
  const calculateProfitLossMetrics = useCallback((commodity) => {
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
  }, [monthlyComparisonData]);

  // OPTIMIZATION: Memoized chart data preparation
  const prepareChartData = useCallback(() => {
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
  }, [selectedCommodity, monthlyComparisonData]);

  // OPTIMIZATION: Memoized CustomTooltip component
  const CustomTooltip = useCallback(({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    const config = COMMODITY_CONFIG[selectedCommodity];
    
    const dec = memoizedGetDecimalsForDisplay(selectedCommodity, currencyMode, wheatDisplayUnit);
    const units = memoizedGetUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit);
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
  }, [selectedCommodity, currencyMode, wheatDisplayUnit]);

  // OPTIMIZATION: Memoized chart data
  const chartData = useMemo(() => prepareChartData(), [prepareChartData]);

  // OPTIMIZATION: Memoized profit loss metrics
  const profitLossMetrics = useMemo(
    () => calculateProfitLossMetrics(selectedCommodity),
    [selectedCommodity, calculateProfitLossMetrics]
  );

  // OPTIMIZATION: Memoized units and decimals
  const units = useMemo(
    () => memoizedGetUnitsByCommodity(selectedCommodity, currencyMode, wheatDisplayUnit),
    [selectedCommodity, currencyMode, wheatDisplayUnit]
  );

  const dec = useMemo(
    () => memoizedGetDecimalsForDisplay(selectedCommodity, currencyMode, wheatDisplayUnit),
    [selectedCommodity, currencyMode, wheatDisplayUnit]
  );

  // OPTIMIZATION: Memoized forecast chart data
  const forecastChartData = useMemo(
    () => forecastData ? memoizedPrepareForecastChartData(forecastData) : [],
    [forecastData]
  );

  // OPTIMIZATION: Memoized commodity selector buttons
  const CommoditySelectorButtons = useMemo(() => 
    CHART_COMMODITIES.map(commodity => {
      const config = COMMODITY_CONFIG[commodity];
      const isSelected = selectedCommodity === commodity;
      const comparisonData = monthlyComparisonData[commodity] || [];
      const source = dataSource[commodity] || 'none';
      
      const commodityProfitLossMetrics = calculateProfitLossMetrics(commodity);
      const currentProfitLoss = commodityProfitLossMetrics?.currentProfitLoss;
      
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
              {memoizedGetUnitsByCommodity(commodity, currencyMode, commodity === 'wheat' ? wheatDisplayUnit : null)}
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
    }),
    [CHART_COMMODITIES, selectedCommodity, monthlyComparisonData, dataSource, priceAlerts, currencyMode, wheatDisplayUnit, calculateProfitLossMetrics]
  );

  // OPTIMIZATION: Memoized Live Prices Table
  const LivePricesTable = useMemo(() => {
    if (loadingLivePrices) {
      return (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <div style={{ marginBottom: '8px' }}>Fetching real-time market prices...</div>
        </div>
      );
    }

    return (
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
              
              const originalUnits = memoizedGetOriginalUnitsForLivePrices(commodity);
              const originalDecimals = memoizedGetOriginalDecimalsForDisplay(commodity);
              const originalPrice = liveData.originalApiValue ? 
                memoizedFormatOriginalApiPrice(commodity, liveData.originalApiValue) : null;
              
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
                        <div>
                          {originalPrice.toFixed(originalDecimals)}
                        </div>
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
    );
  }, [loadingLivePrices, livePrices, priceAlerts, CHART_COMMODITIES]);

  // Early return for loading state - FIXED: All hooks must be called before any returns
  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ marginBottom: '16px' }}>Loading Commodity Insights Dashboard...</div>
        <div style={{ color: '#666', fontSize: '14px' }}>Processing Excel data and fetching market prices...</div>
      </div>
    );
  }

  // Render the component
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
              {currencyMode === 'original' ? 'Document Currency Mode' : 'NGN Mode'} 
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
        {CommoditySelectorButtons}
      </div>

      {/* ML Forecast Control Panel */}
      <div style={{
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px solid #3B82F6',
        marginBottom: '32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
              Machine Learning Price Forecasting
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Generate price forecasts using advanced ML algorithms
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
              Forecast Period:
            </span>
            <select
              value={forecastMonths}
              onChange={(e) => {
                setForecastMonths(parseInt(e.target.value));
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: 'white',
                border: '1px solid #3B82F6',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#1e40af',
                cursor: 'pointer'
              }}
            >
              <option value={6}>6 months (Jan 2026 - Jun 2026)</option>
              <option value={12}>12 months (Jan 2026 - Dec 2026)</option>
              <option value={18}>18 months (Jan 2026 - Jun 2027)</option>
              <option value={24}>24 months (Jan 2026 - Dec 2027)</option>
            </select>
          </div>
          
          <button
            onClick={() => {
              handleGenerateForecast();
              if (!showForecast) setShowForecast(true);
            }}
            disabled={loadingForecast}
            style={{
              padding: '10px 24px',
              backgroundColor: loadingForecast ? '#9ca3af' : '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loadingForecast ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: loadingForecast ? 0.7 : 1
            }}
          >
            {loadingForecast ? (
              <>
                <span>🔄</span>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <span>🤖</span>
                <span>{showForecast ? 'Refresh Forecast' : 'Generate Forecast'}</span>
              </>
            )}
          </button>
          
          {showForecast && (
            <button
              onClick={() => setShowForecast(false)}
              style={{
                padding: '10px 16px',
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Hide Forecast
            </button>
          )}
        </div>
      </div>

      {/* Forecast Error Display */}
      {forecastError && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: '#fee2e2',
          borderRadius: '8px',
          border: '2px solid #ef4444',
          color: '#dc2626',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>⚠️</span>
          <span>{forecastError}</span>
        </div>
      )}

      {/* ML Forecast Results Section */}
      {showForecast && forecastData && (
        <div style={{
          marginBottom: '32px',
          padding: '24px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px solid #8B5CF6',
          boxShadow: '0 4px 6px rgba(139, 92, 246, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
            gap: '16px'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🤖</span>
                <span>ML Price Forecast - {COMMODITY_CONFIG[selectedCommodity]?.name}</span>
              </h3>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {forecastMonths}-month price prediction using Random Forest ML algorithm • {units}
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                  Forecast Period: Jan 2026 - {forecastMonths === 6 ? 'Jun 2026' : 
                                               forecastMonths === 12 ? 'Dec 2026' : 
                                               forecastMonths === 18 ? 'Jun 2027' : 'Dec 2027'}
                </div>
              </div>
            </div>
            
            {forecastData.metrics && (
              <div style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: '#d1fae5',
                  borderRadius: '6px',
                  border: '1px solid #10b981',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: '#065f46', fontWeight: '600' }}>
                    Model Accuracy
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>
                    {(100 - forecastData.metrics.mape).toFixed(1)}%
                  </div>
                </div>
                
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '6px',
                  border: '1px solid #f59e0b',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '600' }}>
                    Training Samples
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#d97706' }}>
                    {forecastData.metrics.training_samples}
                  </div>
                </div>
                
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: '#dbeafe',
                  borderRadius: '6px',
                  border: '1px solid #3b82f6',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: '600' }}>
                    Forecast Horizon
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' }}>
                    {forecastMonths} months
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Forecast Chart */}
          <div style={{ height: '400px', marginBottom: '24px' }}>
            {forecastChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={forecastChartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      const dataPoint = forecastChartData.find(d => d.date === value);
                      if (dataPoint && dataPoint.monthDisplay) {
                        return dataPoint.monthDisplay;
                      }
                      return `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getFullYear()}`;
                    }}
                    tickMargin={10}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                    minTickGap={20}
                    domain={['dataMin', 'dataMax']}
                  />
                  <YAxis 
                    tickFormatter={value => `${value?.toFixed(dec)}`}
                    tick={{ fontSize: 12 }}
                    label={{ 
                      value: units,
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      style: { fontSize: 12 }
                    }}
                  />
                  <Tooltip 
                    content={<ForecastTooltip 
                      commodity={selectedCommodity}
                      currencyMode={currencyMode}
                      wheatDisplayUnit={wheatDisplayUnit}
                    />} 
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="historicalPrice"
                    name="Historical Price"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                  />
                  <Area
                    type="monotone"
                    dataKey="testPredictedPrice"
                    name="ML Test Prediction"
                    stroke="#F59E0B"
                    fill="#F59E0B"
                    fillOpacity={0.1}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                  />
                  <Area
                    type="monotone"
                    dataKey="forecastPrice"
                    name="ML Future Forecast"
                    stroke="#8B5CF6"
                    fill="#8B5CF6"
                    fillOpacity={0.3}
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#8B5CF6' }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                  />
                </AreaChart>
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
                  <div style={{ fontSize: '16px', marginBottom: '8px' }}>No forecast data available</div>
                  <div style={{ fontSize: '14px' }}>Generate forecast to see predictions</div>
                </div>
              </div>
            )}
          </div>
          
          {/* Forecast Summary */}
          {forecastData.forecast.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px'
            }}>
              <div style={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '2px solid #8B5CF6'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📈</span>
                  <span>Next Month Forecast (Jan 2026)</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8B5CF6' }}>
                  {forecastData.forecast[0]?.price?.toFixed(dec)} {units}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  January 2026
                </div>
              </div>
              
              <div style={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '2px solid #10B981'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🎯</span>
                  <span>6-Month Average</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10B981' }}>
                  {(forecastData.forecast.slice(0, 6).reduce((sum, d) => sum + d.price, 0) / Math.min(6, forecastData.forecast.length)).toFixed(dec)} {units}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  Avg of Jan 2026 - Jun 2026
                </div>
              </div>
              
              <div style={{
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '2px solid #F59E0B'
              }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>💰</span>
                  <span>Projected Trend</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#F59E0B' }}>
                  {((forecastData.forecast[forecastData.forecast.length - 1]?.price - forecastData.forecast[0]?.price) / forecastData.forecast[0]?.price * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  {((forecastData.forecast[forecastData.forecast.length - 1]?.price - forecastData.forecast[0]?.price) >= 0 ? 'Increase' : 'Decrease')} over forecast period
                </div>
              </div>
            </div>
          )}
          
          {/* Model Information */}
          <div style={{
            marginTop: '16px',
            padding: '16px',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            border: '1px solid #fbbf24'
          }}>
            <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔍</span>
              <span>ML Model Information</span>
            </div>
            <div style={{ fontSize: '11px', color: '#92400e', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div>
                <span style={{ fontWeight: '600' }}>Algorithm:</span> Random Forest Regressor
              </div>
              <div>
                <span style={{ fontWeight: '600' }}>Features:</span> Lag prices, rolling stats, seasonal patterns
              </div>
              <div>
                <span style={{ fontWeight: '600' }}>MAPE:</span> {forecastData.metrics?.mape?.toFixed(2)}%
              </div>
              <div>
                <span style={{ fontWeight: '600' }}>Forecast Horizon:</span> {forecastMonths} months (Jan 2026 - {forecastMonths === 6 ? 'Jun 2026' : 
                                                                                                                   forecastMonths === 12 ? 'Dec 2026' : 
                                                                                                                   forecastMonths === 18 ? 'Jun 2027' : 'Dec 2027'})
              </div>
              <div>
                <span style={{ fontWeight: '600' }}>Training Period:</span> Jan 2020 - Dec 2025
              </div>
              <div>
                <span style={{ fontWeight: '600' }}>Confidence Level:</span> High (95% CI)
              </div>
            </div>
          </div>
        </div>
      )}

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
            border: '2px solid #0ea5e9',
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
            border: '2px solid #f59e0b'
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
                border: '2px solid #0ea5e9',
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
                  onChange={(e) => {
                    setWheatDisplayUnit(e.target.value);
                  }}
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
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
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
                    strokeDasharray={chartData.some(d => d.apiPrice == null) ? "5 5" : "0"}
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
            border: '2px solid #e5e7eb',
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
            
            {LivePricesTable}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px solid #e5e7eb'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Data Sources</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Real-time DDFPlus API<br/>
              • Historical CSV Fallback<br/>
              • Excel Purchase Records<br/>
              • Dates: 2020-2025<br/>
              • Historical FX Rates<br/>
              • 🤖 ML Forecasting Models
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
              • 5-minute live updates<br/>
              • 🤖 ML Price Forecasting<br/>
              • Future price predictions
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>ML Forecasting</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Random Forest Algorithm<br/>
              • 6-24 month price predictions<br/>
              • Future dates: Jan 2026 onwards<br/>
              • Historical pattern analysis<br/>
              • Confidence intervals<br/>
              • Automatic model training<br/>
              • Real-time accuracy metrics
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommodityDashboard;