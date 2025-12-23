// src/components/CommodityDashboard.jsx - UPDATED FOR CORRECT PALM OIL UNITS
import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Import your Excel data
import {
  COMPLETE_WHEAT_DATA,
  COMPLETE_PALM_OIL_DATA,  // This is now in USD/tonne
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

// Exchange rates - will be fetched dynamically
const DEFAULT_FX_RATES = {
  USD_to_NGN: 1460,
  EUR_to_NGN: 1600,
  GHS_to_USD: 0.087,
  USD_to_GHS: 11.48,
  MYR_to_USD: 0.21,
  USD_to_MYR: 4.76,
  EUR_to_USD: 1.08,
  MYR_to_NGN: 445
};

// Conversion factors
const BUSHEL_TO_KG_WHEAT = 27.2155;
const TONNE_TO_KG = 1000;
const LB_TO_KG = 0.45359237;
const ALUMINUM_CAN_WEIGHT_KG = 0.013;

// Currency configuration for each commodity - UPDATED FOR PALM OIL
const COMMODITY_CURRENCIES = {
  wheat: 'USD',
  milling_wheat: 'USD',
  palm: 'USD',  // CHANGED: Palm oil is now in USD (USD/tonne in Excel)
  crude_palm: 'USD',
  sugar: 'NGN',
  aluminum: 'USD'
};

// Unit configuration for each commodity - UPDATED
const COMMODITY_UNITS = {
  wheat: { excel: 'USD/kg', api: 'USD/kg', chart: 'USD/kg' },
  milling_wheat: { excel: 'USD/kg', api: 'EUR/kg', chart: 'USD/kg' },
  palm: { excel: 'USD/tonne', api: 'MYR/tonne', chart: 'USD/tonne' }, // UPDATED
  crude_palm: { excel: 'USD/kg', api: 'USD/kg', chart: 'USD/kg' },  // Crude palm is USD/kg
  sugar: { excel: 'NGN/kg', api: 'USD/kg', chart: 'NGN/kg' },
  aluminum: { excel: 'USD/tonne', api: 'USD/tonne', chart: 'USD/tonne' }
};

const decimalsByCommodity = {
  wheat: 2,
  milling_wheat: 2,
  palm: 2,
  crude_palm: 2,
  sugar: 2,
  aluminum: 2
};

// Commodity names and colors - UPDATED with Brent Crude Oil
const COMMODITY_CONFIG = {
  wheat: { 
    name: 'Wheat CBOT', 
    icon: '🌾', 
    excelColor: '#3B82F6',
    apiColor: '#10B981',
    category: 'Grains',
    showInChart: false
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
    excelColor: '#F59E0B', // Orange for palm oil
    apiColor: '#10B981',
    category: 'Oils',
    showInChart: true
  },
  crude_palm: { 
    name: 'Brent Crude Oil',  // RENAMED
    icon: '🛢️', 
    excelColor: '#EF4444', // Red for crude
    apiColor: '#10B981',
    category: 'Oils',
    showInChart: true
  },
  sugar: { 
    name: 'Sugar', 
    icon: '🍬', 
    excelColor: '#EC4899', // Pink
    apiColor: '#10B981',
    category: 'Softs',
    showInChart: true
  },
  aluminum: { 
    name: 'Aluminum',
    icon: '🥫', 
    excelColor: '#06B6D4', // Cyan
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
  palm: COMPLETE_PALM_OIL_DATA,  // This is now USD/tonne
  crude_palm: COMPLETE_CRUDE_PALM_OIL_DATA,  // This is USD/kg
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

// NEW: Function to fetch historical FX rates for specific dates
async function fetchHistoricalFXRate(dateStr, fromCurrency, toCurrency) {
  try {
    if (fromCurrency === toCurrency) return 1;
    
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // For real implementation, you would use a historical FX API
    // For now, using approximate historical rates
    const historicalRates = {
      // USD to NGN historical rates
      'USD_NGN': {
        '2020': 380, '2021': 410, '2022': 450,
        '2023': 750, '2024': 900, '2025': 1460
      },
      // EUR to USD historical rates
      'EUR_USD': {
        '2020': 1.18, '2021': 1.20, '2022': 1.05,
        '2023': 1.08, '2024': 1.07, '2025': 1.08
      },
      // MYR to USD historical rates (for palm oil)
      'MYR_USD': {
        '2020': 0.24, '2021': 0.24, '2022': 0.22,
        '2023': 0.21, '2024': 0.21, '2025': 0.21
      }
    };
    
    const key = `${fromCurrency}_${toCurrency}`;
    
    if (historicalRates[key] && historicalRates[key][year]) {
      return historicalRates[key][year];
    }
    
    // Fallback to default rates
    const defaultKey = `${fromCurrency}_to_${toCurrency}`;
    const reverseKey = `${toCurrency}_to_${fromCurrency}`;
    
    if (DEFAULT_FX_RATES[defaultKey]) {
      return DEFAULT_FX_RATES[defaultKey];
    } else if (DEFAULT_FX_RATES[reverseKey]) {
      return 1 / DEFAULT_FX_RATES[reverseKey];
    }
    
    return 1;
    
  } catch (error) {
    console.error('Error fetching historical FX rate:', error);
    const key = `${fromCurrency}_to_${toCurrency}`;
    return DEFAULT_FX_RATES[key] || 1;
  }
}

// NEW: Convert price based on currency mode with historical FX
async function convertPriceWithHistoricalFX(price, fromCurrency, toCurrency, dateStr = null) {
  if (price == null || isNaN(Number(price))) return null;
  
  const value = Number(price);
  
  if (fromCurrency === toCurrency) return value;
  
  const rate = await fetchHistoricalFXRate(dateStr, fromCurrency, toCurrency);
  return value * rate;
}

// Helper function to get FX rate (for non-historical conversions)
function getFXRate(fromCurrency, toCurrency) {
  const key = `${fromCurrency}_to_${toCurrency}`;
  const reverseKey = `${toCurrency}_to_${fromCurrency}`;
  
  if (DEFAULT_FX_RATES[key]) {
    return DEFAULT_FX_RATES[key];
  } else if (DEFAULT_FX_RATES[reverseKey]) {
    return 1 / DEFAULT_FX_RATES[reverseKey];
  }
  
  return 1;
}

// Convert API value to target currency - UPDATED FOR PALM OIL
async function convertApiValueToTargetCurrency(commodity, apiValue, targetCurrency, dateStr = null, currencyMode) {
  if (apiValue == null || isNaN(Number(apiValue))) return null;
  const value = Number(apiValue);

  let apiPriceInOriginalCurrency;
  let apiCurrency;
  let apiUnit;

  switch(commodity) {
    case 'wheat':
      // CBOT Wheat: cents per bushel to USD/kg
      const usdPerBushel = value / 100;
      apiPriceInOriginalCurrency = usdPerBushel / BUSHEL_TO_KG_WHEAT;
      apiCurrency = 'USD';
      apiUnit = 'USD/kg';
      break;

    case 'milling_wheat':
      // Milling Wheat: EUR per tonne to EUR/kg
      const eurPerTonne = value;
      apiPriceInOriginalCurrency = eurPerTonne / TONNE_TO_KG;
      apiCurrency = 'EUR';
      apiUnit = 'EUR/kg';
      break;

    case 'palm':
      // Palm Oil (KO*1) is in MYR per metric ton
      // Keep as MYR/tonne (API provides in MYR/tonne)
      apiPriceInOriginalCurrency = value; // MYR/tonne
      apiCurrency = 'MYR';
      apiUnit = 'MYR/tonne';
      break;

    case 'crude_palm':
      // Brent Crude Oil: CB*1 is in USD per barrel
      // Convert to USD/tonne for comparison
      const BARREL_TO_TONNE = 0.1364; // Approximate conversion
      apiPriceInOriginalCurrency = value / BARREL_TO_TONNE;
      apiCurrency = 'USD';
      apiUnit = 'USD/tonne';
      break;
    
    case 'sugar':
      // Sugar: cents per lb to USD/kg
      const usdPerLb = value / 100;
      apiPriceInOriginalCurrency = usdPerLb / LB_TO_KG;
      apiCurrency = 'USD';
      apiUnit = 'USD/kg';
      break;

    case 'aluminum':
      // Aluminum: USD per tonne
      apiPriceInOriginalCurrency = value; // Already USD/tonne
      apiCurrency = 'USD';
      apiUnit = 'USD/tonne';
      break;

    default:
      return value;
  }

  // Convert to target currency if needed
  let finalPrice = apiPriceInOriginalCurrency;
  
  if (currencyMode === 'ngn' && apiCurrency !== 'NGN') {
    // Convert to NGN
    const rate = await fetchHistoricalFXRate(dateStr, apiCurrency, 'NGN');
    finalPrice = apiPriceInOriginalCurrency * rate;
  } else if (currencyMode === 'original' && apiCurrency !== targetCurrency) {
    // Convert to target currency
    const rate = await fetchHistoricalFXRate(dateStr, apiCurrency, targetCurrency);
    finalPrice = apiPriceInOriginalCurrency * rate;
  }

  return finalPrice;
}

// Convert Excel purchase price to target currency - UPDATED FOR PALM OIL
async function convertExcelPriceToTargetCurrency(commodity, excelItem, targetCurrency, currencyMode, dateStr) {
  if (!excelItem) return null;
  
  let priceInOriginalCurrency;
  let excelCurrency;
  
  switch(commodity) {
    case 'wheat':
    case 'milling_wheat':
      if (excelItem.currency === 'GHS') {
        // Convert GHS to USD first
        const ghsToUsdRate = await fetchHistoricalFXRate(dateStr, 'GHS', 'USD');
        priceInOriginalCurrency = excelItem.rate * ghsToUsdRate;
        excelCurrency = 'USD';
      } else {
        priceInOriginalCurrency = excelItem.rate;
        excelCurrency = excelItem.currency;
      }
      break;
      
    case 'palm':
      // Palm oil: Excel data is in USD/tonne
      priceInOriginalCurrency = excelItem.rate; // This is USD/tonne
      excelCurrency = 'USD';
      break;
      
    case 'crude_palm':
      // Brent Crude: Excel data is in USD/kg
      priceInOriginalCurrency = excelItem.rate;
      excelCurrency = 'USD';
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

  // If currency mode is NGN, convert from original currency to NGN
  if (currencyMode === 'ngn' && excelCurrency !== 'NGN') {
    const rate = await fetchHistoricalFXRate(dateStr, excelCurrency, 'NGN');
    return priceInOriginalCurrency * rate;
  }

  // If currency mode is original but target currency is different, convert
  if (currencyMode === 'original' && excelCurrency !== targetCurrency) {
    const rate = await fetchHistoricalFXRate(dateStr, excelCurrency, targetCurrency);
    return priceInOriginalCurrency * rate;
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

// Process Excel data by month (average per month) - UPDATED FOR PALM OIL
async function processExcelDataByMonth(commodity, currencyMode) {
  const rawData = EXCEL_DATA_SOURCES[commodity] || [];
  
  console.log(`Processing ${commodity} data in ${currencyMode} mode:`, {
    rawDataLength: rawData.length
  });
  
  const targetCurrency = currencyMode === 'original' 
    ? COMMODITY_CURRENCIES[commodity] 
    : 'NGN';
  
  const monthlyData = {};
  
  // Process each Excel item
  for (const item of rawData) {
    const dateStr = getExcelDateForMonth(commodity, item);
    const monthKey = getMonthKey(dateStr);
    
    if (!monthKey) {
      console.warn(`Could not parse date for ${commodity} item:`, dateStr);
      continue;
    }
    
    const year = parseInt(monthKey.split('-')[0]);
    const currentYear = new Date().getFullYear();
    
    if (year < 2020 || year > currentYear + 1) {
      console.warn(`Skipping unrealistic year for ${commodity}:`, monthKey, 'from date:', dateStr);
      continue;
    }
    
    const priceInTargetCurrency = await convertExcelPriceToTargetCurrency(
      commodity, 
      item, 
      targetCurrency,
      currencyMode,
      dateStr
    );
    
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
    monthDisplay: getMonthDisplay(month.monthKey),
    excelPrice: month.values.reduce((sum, val) => sum + val, 0) / month.values.length,
    transactionCount: month.values.length,
    dates: month.dates,
    currencies: month.currencies,
    unit: COMMODITY_UNITS[commodity].excel
  })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  
  const filteredResult = filterRecentData(result, 5);
  
  console.log(`${commodity} processed data in ${currencyMode}:`, {
    totalMonths: result.length,
    filteredMonths: filteredResult.length,
    targetCurrency,
    sampleMonths: filteredResult.slice(0, 3)
  });
  
  return filteredResult;
}

// Fetch monthly prices from REAL API
async function fetchMonthlyPricesWithVariation(symbol, months, commodity, currencyMode) {
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
    
    console.log(`Fetching REAL API data for ${symbol} (${commodity}), months:`, recentMonths);
    
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
          
          // Convert to target currency
          const targetCurrency = currencyMode === 'original' 
            ? COMMODITY_CURRENCIES[commodity] 
            : 'NGN';
          
          const convertedPrice = await convertApiValueToTargetCurrency(
            commodity, 
            monthlyAvg, 
            targetCurrency,
            dailyPrices[0]?.date,
            currencyMode
          );
          
          monthlyResults.push({
            monthKey: month,
            avgPrice: convertedPrice,
            dataPoints: dailyPrices.length,
            sampleDates: dailyPrices.slice(0, 3).map(d => d.date),
            source: 'real_api'
          });
          
          console.log(`✅ ${month} for ${symbol}: ${dailyPrices.length} trading days, converted: ${convertedPrice?.toFixed(2)} ${targetCurrency}`);
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

// Process API data by month
function processApiDataByMonth(commodity, apiMonthlyData) {
  return apiMonthlyData.map(item => ({
    monthKey: item.monthKey,
    monthDisplay: getMonthDisplay(item.monthKey),
    apiPrice: item.avgPrice,
    dataPoints: item.dataPoints,
    source: item.source || 'api'
  })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

// Combine Excel and API data by month
function combineMonthlyData(excelMonthly, apiMonthly) {
  const excelMonths = excelMonthly.map(item => item.monthKey);
  
  return excelMonths.map(monthKey => {
    const excelMonth = excelMonthly.find(item => item.monthKey === monthKey);
    const apiMonth = apiMonthly.find(item => item.monthKey === monthKey);
    
    return {
      monthKey,
      monthDisplay: getMonthDisplay(monthKey),
      excelPrice: excelMonth?.excelPrice || null,
      apiPrice: apiMonth?.apiPrice || null,
      excelTransactions: excelMonth?.transactionCount || 0,
      apiDataPoints: apiMonth?.dataPoints || 0,
      apiSource: apiMonth?.source || 'none',
      excelUnit: excelMonth?.unit || '',
      unit: excelMonth?.unit || COMMODITY_UNITS[excelMonth?.commodity]?.chart || ''
    };
  });
}

// Fetch current price with history
async function fetchCurrentPriceWithHistory(symbol, commodity, currencyMode) {
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
    
    const targetCurrency = currencyMode === 'original' 
      ? COMMODITY_CURRENCIES[commodity] 
      : 'NGN';
    
    // Convert all prices
    const current = await convertApiValueToTargetCurrency(
      commodity, 
      latest.price, 
      targetCurrency,
      latest.date,
      currencyMode
    );
    
    const previous = dailyData.length >= 2 ? 
      await convertApiValueToTargetCurrency(
        commodity, 
        dailyData[dailyData.length - 2].price, 
        targetCurrency,
        dailyData[dailyData.length - 2].date,
        currencyMode
      ) : null;
    
    const weekAgoConverted = weekAgo ? 
      await convertApiValueToTargetCurrency(
        commodity, 
        weekAgo.price, 
        targetCurrency,
        weekAgo.date,
        currencyMode
      ) : null;
    
    const monthAgoConverted = monthAgo ? 
      await convertApiValueToTargetCurrency(
        commodity, 
        monthAgo.price, 
        targetCurrency,
        monthAgo.date,
        currencyMode
      ) : null;
    
    const yearAgoConverted = yearAgo ? 
      await convertApiValueToTargetCurrency(
        commodity, 
        yearAgo.price, 
        targetCurrency,
        yearAgo.date,
        currencyMode
      ) : null;
    
    return {
      current,
      previous,
      weekAgo: weekAgoConverted,
      monthAgo: monthAgoConverted,
      yearAgo: yearAgoConverted,
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

// Fetch daily prices
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

// Main Component
const CommodityDashboard = () => {
  const [currencyMode, setCurrencyMode] = useState('original');
  const [selectedCommodity, setSelectedCommodity] = useState(DEFAULT_CHART_COMMODITY);
  const [commodityData, setCommodityData] = useState({});
  const [monthlyComparisonData, setMonthlyComparisonData] = useState({});
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingLivePrices, setLoadingLivePrices] = useState(false);
  const [error, setError] = useState('');
  const [dataDebug, setDataDebug] = useState('');
  const [apiStatus, setApiStatus] = useState('connecting');

  // Process Excel data by month - Memoized
  const excelMonthlyData = useMemo(() => {
    const data = {};
    Object.keys(COMMODITY_CONFIG).forEach(commodity => {
      data[commodity] = [];
    });
    return data;
  }, []);

  // Fetch live prices for all commodities
  useEffect(() => {
    const fetchLivePrices = async () => {
      setLoadingLivePrices(true);
      setApiStatus('fetching_live');
      
      try {
        const liveData = {};
        
        for (const [commodity, symbol] of Object.entries(COMMODITY_SYMBOLS)) {
          console.log(`Fetching live price with history for ${commodity} (${symbol})...`);
          
          const priceData = await fetchCurrentPriceWithHistory(symbol, commodity, currencyMode);
          
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
              status: 'no_data',
              unit: COMMODITY_UNITS[commodity].chart
            };
            continue;
          }
          
          const percentages = {
            day: priceData.previous ? calculatePercentageChange(priceData.current, priceData.previous) : null,
            week: priceData.weekAgo ? calculatePercentageChange(priceData.current, priceData.weekAgo) : null,
            month: priceData.monthAgo ? calculatePercentageChange(priceData.current, priceData.monthAgo) : null,
            year: priceData.yearAgo ? calculatePercentageChange(priceData.current, priceData.yearAgo) : null
          };
          
          liveData[commodity] = {
            current: priceData.current,
            previous: priceData.previous,
            weekAgo: priceData.weekAgo,
            monthAgo: priceData.monthAgo,
            yearAgo: priceData.yearAgo,
            percentages,
            symbol,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'success',
            unit: COMMODITY_UNITS[commodity].chart,
            currency: currencyMode === 'original' ? COMMODITY_CURRENCIES[commodity] : 'NGN'
          };
          
          console.log(`Live price for ${commodity}:`, {
            current: priceData.current,
            unit: COMMODITY_UNITS[commodity].chart,
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
            status: 'error',
            unit: COMMODITY_UNITS[commodity].chart,
            currency: currencyMode === 'original' ? COMMODITY_CURRENCIES[commodity] : 'NGN'
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
  }, [currencyMode]);

  // Fetch API data and combine with Excel data
  useEffect(() => {
    const fetchAllCommodityData = async () => {
      setLoading(true);
      setError('');
      setApiStatus('fetching_historical');
      
      try {
        const dataPromises = Object.entries(COMMODITY_SYMBOLS).map(async ([commodity, symbol]) => {
          const excelMonthly = await processExcelDataByMonth(commodity, currencyMode);
          
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
          const apiMonthlyRaw = await fetchMonthlyPricesWithVariation(symbol, excelMonths, commodity, currencyMode);
          
          const apiMonthly = processApiDataByMonth(commodity, apiMonthlyRaw);
          const combinedData = combineMonthlyData(excelMonthly, apiMonthly);
          
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
        
        setDataDebug(`API Data: ${apiDataSummary} | Currency Mode: ${currencyMode.toUpperCase()}`);
        setApiStatus('connected');
        
      } catch (err) {
        console.error('Error in fetchAllCommodityData:', err);
        setError(`Failed to fetch data: ${err.message}. Please check your API connection.`);
        setApiStatus('error');
        
        const emptyData = {};
        const emptyComparison = {};
        
        Object.keys(COMMODITY_CONFIG).forEach(async (commodity) => {
          const excelMonthly = await processExcelDataByMonth(commodity, currencyMode);
          const combinedData = excelMonthly.map(item => ({
            monthKey: item.monthKey,
            monthDisplay: item.monthDisplay,
            excelPrice: item.excelPrice,
            apiPrice: null,
            excelTransactions: item.transactionCount,
            apiDataPoints: 0,
            unit: item.unit
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
  }, [currencyMode]);

  // Helper function to calculate percentage change
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
      apiSource: item.apiSource,
      unit: item.unit || COMMODITY_UNITS[selectedCommodity]?.chart
    }));
  };

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    const config = COMMODITY_CONFIG[selectedCommodity];
    const dec = decimalsByCommodity[selectedCommodity] || 2;
    const unit = data.unit || COMMODITY_UNITS[selectedCommodity]?.chart || '';

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
              {data.excelPrice.toFixed(dec)} {unit}
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
              {data.apiSource === 'real_api' && (
                <span style={{
                  fontSize: '10px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  padding: '1px 4px',
                  borderRadius: '3px'
                }}>
                  Live API
                </span>
              )}
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 'bold', color: config.apiColor, fontSize: '16px' }}>
                {data.apiPrice.toFixed(dec)} {unit}
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
                {Math.abs(data.excelPrice - data.apiPrice).toFixed(dec)} {unit}
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
        <div style={{ marginBottom: '16px' }}>Loading commodity dashboard...</div>
        <div style={{ color: '#666', fontSize: '14px' }}>Processing Excel data and fetching REAL market prices from API...</div>
      </div>
    );
  }

  const chartData = prepareChartData();
  const selectedConfig = COMMODITY_CONFIG[selectedCommodity];
  const unit = COMMODITY_UNITS[selectedCommodity]?.chart || '';

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
              📈 Commodity Price Intelligence
            </h2>
            <div style={{ color: '#666', fontSize: '14px', marginTop: '8px' }}>
              Real-time market comparison with historical FX rates • Dynamic unit conversion
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
            
            {/* Status Badge */}
            <div style={{
              padding: '8px 16px',
              backgroundColor: apiStatus === 'connected' ? '#d1fae5' : 
                              apiStatus === 'error' ? '#fee2e2' : '#fef3c7',
              borderRadius: '8px',
              border: `2px solid ${apiStatus === 'connected' ? '#10b981' : 
                                 apiStatus === 'error' ? '#dc2626' : '#fbbf24'}`,
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '18px' }}>
                {apiStatus === 'connected' ? '✅' : apiStatus === 'error' ? '⚠️' : '🔄'}
              </span>
              {apiStatus === 'connected' ? 'API Connected' : 
               apiStatus === 'error' ? 'API Error' : 'Connecting...'}
            </div>
          </div>
        </div>
        
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
                  ? `• Wheat: USD/kg • Milling Wheat: USD/kg • Palm Oil: USD/tonne • Brent Crude: USD/kg • Sugar: NGN/kg • Aluminum: USD/tonne`
                  : '• All commodities converted to NGN using historical FX rates'}
              </div>
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
        <strong>API Status:</strong> {dataDebug || 'Loading...'} | <strong>Mode:</strong> Real API Only | 
        <strong> Currency:</strong> {currencyMode.toUpperCase()}
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

      {/* Main Dashboard Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '32px',
        marginBottom: '32px'
      }}>
        {/* Left Column: Commodity Selector */}
        <div>
          <div style={{
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#374151' }}>
              Commodities
            </h3>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {CHART_COMMODITIES.map(commodity => {
                const config = COMMODITY_CONFIG[commodity];
                const isSelected = selectedCommodity === commodity;
                const livePrice = livePrices[commodity];
                const unit = COMMODITY_UNITS[commodity].chart;
                
                return (
                  <div
                    key={commodity}
                    onClick={() => setSelectedCommodity(commodity)}
                    style={{
                      padding: '16px',
                      backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                      borderRadius: '10px',
                      border: `2px solid ${isSelected ? '#3B82F6' : '#e2e8f0'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: isSelected ? config.excelColor : '#E2E8F0',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px'
                      }}>
                        {config.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: '600',
                          color: isSelected ? '#1E293B' : '#475569',
                          fontSize: '15px'
                        }}>
                          {config.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#94A3B8'
                        }}>
                          {config.category} • {unit}
                        </div>
                      </div>
                    </div>
                    
                    {livePrice && livePrice.current && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '12px',
                        borderTop: '1px solid #E2E8F0'
                      }}>
                        <div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: '#1E293B'
                          }}>
                            {livePrice.current.toFixed(decimalsByCommodity[commodity])}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#94A3B8'
                          }}>
                            {unit}
                          </div>
                        </div>
                        {livePrice.percentages?.day && (
                          <div style={{
                            padding: '4px 10px',
                            backgroundColor: livePrice.percentages.day >= 0 ? '#d1fae5' : '#fee2e2',
                            color: livePrice.percentages.day >= 0 ? '#059669' : '#dc2626',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {livePrice.percentages.day >= 0 ? '▲' : '▼'} {Math.abs(livePrice.percentages.day).toFixed(1)}%
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
          <div style={{
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '16px',
              fontWeight: '600',
              color: '#1E293B'
            }}>
              Unit Legend
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {Object.entries(COMMODITY_UNITS).map(([commodity, units]) => (
                <div key={commodity} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #F1F5F9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: COMMODITY_CONFIG[commodity]?.excelColor || '#94A3B8'
                    }}></div>
                    <span style={{ fontSize: '13px', color: '#475569' }}>
                      {COMMODITY_CONFIG[commodity]?.name}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748B',
                    backgroundColor: '#F8FAFC',
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}>
                    {units.chart}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Chart */}
        <div>
          <div style={{ 
            padding: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            marginBottom: '24px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#374151' }}>
                  {selectedConfig.name} - Price Analysis
                </h3>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Purchase vs Market Prices • Units: {unit} • {currencyMode === 'original' ? 'Document Currency' : 'NGN'}
                </div>
              </div>
              <div style={{ 
                display: 'flex',
                gap: '12px'
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
                  <div style={{ width: '10px', height: '3px', backgroundColor: selectedConfig.excelColor }}></div>
                  <span>Purchase Price</span>
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
                  <div style={{ width: '10px', height: '3px', backgroundColor: selectedConfig.apiColor }}></div>
                  <span>Market Price</span>
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
                      tickFormatter={value => `${value.toFixed(decimalsByCommodity[selectedCommodity])}`}
                      tick={{ fontSize: 12 }}
                      label={{ 
                        value: unit,
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
                      name="Purchase Price"
                      stroke={selectedConfig.excelColor}
                      strokeWidth={3}
                      dot={{ r: 4, fill: selectedConfig.excelColor }}
                      activeDot={{ r: 6, fill: selectedConfig.excelColor }}
                      connectNulls={true}
                    />
                    <Line
                      type="monotone"
                      dataKey="apiPrice"
                      name="Market Price (API)"
                      stroke={selectedConfig.apiColor}
                      strokeWidth={3}
                      dot={{ r: 4, fill: selectedConfig.apiColor }}
                      activeDot={{ r: 6, fill: selectedConfig.apiColor }}
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
                    <div style={{ fontSize: '16px', marginBottom: '8px' }}>No data available</div>
                    <div style={{ fontSize: '14px' }}>No recent data found for {selectedConfig.name}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Prices Table */}
          <div style={{
            padding: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '700',
              color: '#1E293B'
            }}>
              Live Market Prices
            </h3>
            
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
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Current Price</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>24h Change</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Unit</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHART_COMMODITIES.map((commodity, index) => {
                      const config = COMMODITY_CONFIG[commodity];
                      const livePrice = livePrices[commodity];
                      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                      
                      if (!livePrice) return null;
                      
                      const hasData = livePrice.current !== null;
                      const statusColor = hasData ? '#059669' : '#dc2626';
                      const statusText = hasData ? 'Live' : 'No Data';
                      
                      return (
                        <tr 
                          key={commodity} 
                          style={{ 
                            backgroundColor: rowBg,
                            cursor: 'pointer'
                          }}
                          onClick={() => setSelectedCommodity(commodity)}
                        >
                          <td style={{ 
                            padding: '12px', 
                            borderBottom: '1px solid #e2e8f0',
                            fontWeight: '600'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                backgroundColor: config.excelColor + '20',
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
                                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                                  {config.category} • {COMMODITY_SYMBOLS[commodity]}
                                </div>
                              </div>
                            </div>
                          </td>
                          
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            fontWeight: '700',
                            color: hasData ? '#1E293B' : '#9ca3af'
                          }}>
                            {hasData ? `${livePrice.current.toFixed(decimalsByCommodity[commodity])}` : '—'}
                          </td>
                          
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {hasData && livePrice.percentages?.day !== null ? (
                              <span style={{
                                fontWeight: '600',
                                color: livePrice.percentages.day >= 0 ? '#059669' : '#dc2626',
                                backgroundColor: livePrice.percentages.day >= 0 ? '#d1fae5' : '#fee2e2',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {livePrice.percentages.day >= 0 ? '▲' : '▼'} {Math.abs(livePrice.percentages.day).toFixed(2)}%
                              </span>
                            ) : '—'}
                          </td>
                          
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            color: '#64748B',
                            fontSize: '13px'
                          }}>
                            {livePrice?.unit || COMMODITY_UNITS[commodity].chart}
                          </td>
                          
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            <span style={{
                              fontWeight: '600',
                              color: statusColor,
                              backgroundColor: statusColor === '#059669' ? '#d1fae5' : '#fee2e2',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px'
                            }}>
                              {statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '20px',
                  paddingTop: '20px',
                  borderTop: '1px solid #E2E8F0',
                  fontSize: '13px',
                  color: '#94A3B8'
                }}>
                  <div>
                    Last updated: {livePrices.wheat?.lastUpdated || 'N/A'}
                    <span style={{ marginLeft: '16px' }}>
                      Currency: {currencyMode === 'original' ? 'Document' : 'NGN'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setLoadingLivePrices(true);
                      // Refresh function would be called here
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3B82F6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
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

      {/* Footer */}
      <div style={{
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Data Sources</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • DDFPlus Commodity API (Real-time)<br/>
              • Excel Purchase Records<br/>
              • Historical FX Rates (Dynamic)<br/>
              • Date Range: 2020-2025
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Unit Configuration</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Palm Oil: USD/tonne<br/>
              • Brent Crude: USD/kg<br/>
              • Aluminum: USD/tonne<br/>
              • Sugar: NGN/kg
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>System Info</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
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