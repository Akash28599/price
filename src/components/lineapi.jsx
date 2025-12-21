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
  palm: 'KO*1',
  sugar: 'SB*1',
  aluminum: 'AL*1',
  crude_palm: 'CB*1'
};

// Exchange rates
const FX_RATES = {
  USD_to_NGN: 1460,
  GHS_to_USD: 0.087,
  USD_to_GHS: 11.48,
  MYR_to_USD: 0.21,  // Malaysian Ringgit to USD (approximate, check current rate)
  USD_to_MYR: 4.76   // USD to Malaysian Ringgit
};

// Conversion factors
const BUSHEL_TO_KG_WHEAT = 27.2155;
const TONNE_TO_KG = 1000;
const LB_TO_KG = 0.45359237;
const ALUMINUM_CAN_WEIGHT_KG = 0.013;

const unitsByCommodity = {
  wheat: 'NGN/kg',
  palm: 'NGN/kg',
  crude_palm: 'NGN/kg',
  sugar: 'NGN/kg',
  aluminum: 'NGN/kg'
};

const decimalsByCommodity = {
  wheat: 2,
  palm: 2,
  crude_palm: 2,
  sugar: 2,
  aluminum: 2
};

// Commodity names and colors
const COMMODITY_CONFIG = {
  wheat: { 
    name: 'Wheat Flour', 
    icon: '🌾', 
    excelColor: '#3B82F6',
    apiColor: '#10B981',
    category: 'Grains'
  },
  palm: { 
    name: 'Palm Oil', 
    icon: '🌴', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    category: 'Oils'
  },
  crude_palm: { 
    name: 'Crude Palm Oil', 
    icon: '🛢️', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    category: 'Oils'
  },
  sugar: { 
    name: 'Sugar', 
    icon: '🍬', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    category: 'Softs'
  },
  aluminum: { 
    name: 'Aluminum (Raw Material)',
    icon: '🥫', 
    excelColor: '#3B82F6', 
    apiColor: '#10B981',
    category: 'Metals'
  }
};

// Excel data mapping by commodity
const EXCEL_DATA_SOURCES = {
  wheat: COMPLETE_WHEAT_DATA,
  palm: COMPLETE_PALM_OIL_DATA,
  crude_palm: COMPLETE_CRUDE_PALM_OIL_DATA,
  sugar: SUGAR_MONTH_COST,
  aluminum: CAN_DATA
};

// Negotiated aluminum price - 2400 USD/tonne
const NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE = 2400;

// Function to format date for API
function formatDateForAPI(date) {
  return date.toISOString().split('T')[0];
}

// Function to get month key (YYYY-MM)
function getMonthKey(dateStr) {
  if (!dateStr) return null;
  
  // If it's already in YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Handle Excel date formats
  if (typeof dateStr === 'string') {
    // Handle format like "Apr-24" or "Apr-2024"
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
      
      // Convert 2-digit year to 4-digit (assuming 2000s for recent years)
      if (yearStr.length === 2) {
        const currentYear = new Date().getFullYear();
        const shortYear = parseInt(yearStr);
        year = shortYear + (shortYear <= (currentYear % 100) ? 2000 : 1900);
      }
      
      return `${year}-${month}`;
    }
    
    // Handle ISO date strings
    if (dateStr.includes('T')) {
      const date = new Date(dateStr);
      if (!isNaN(date)) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
    }
  }
  
  // Try parsing as Date object
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

// Convert API value to NGN/kg for all commodities
function convertApiValueToNGNPerKg(commodity, apiValue) {
  if (apiValue == null || isNaN(Number(apiValue))) return null;
  const value = Number(apiValue);

  switch(commodity) {
    case 'wheat':
      // ZW*1: returns US cents per bushel ✓
      const usdPerBushel = value / 100;
      const usdPerKg = usdPerBushel / BUSHEL_TO_KG_WHEAT;
      return usdPerKg * FX_RATES.USD_to_NGN;

    case 'palm':
      // KO*1: returns Malaysian Ringgit (MYR) per metric ton
      // Example: 3500 means 3,500 MYR/tonne
      const myrPerTonne = value;
      const myrPerKg = myrPerTonne / 1000; // Convert to MYR/kg
      const usdPerKgPalm = myrPerKg * FX_RATES.MYR_to_USD; // Convert MYR to USD
      return usdPerKgPalm * FX_RATES.USD_to_NGN; // Convert USD to NGN

    case 'crude_palm':
      // CB*1: This might be Brent Crude Oil, not Crude Palm Oil!
      // Check if this symbol is correct for Crude Palm Oil
      const BARREL_TO_KG = 136.4;
      const usdPerKgCrude = value / BARREL_TO_KG;
      return usdPerKgCrude * FX_RATES.USD_to_NGN;
    
    case 'sugar':
      // SB*1: returns US cents per pound ✓
      const usdPerLb = value / 100;
      const usdPerKgSugar = usdPerLb / LB_TO_KG;
      return usdPerKgSugar * FX_RATES.USD_to_NGN;

    case 'aluminum':
      // AL*1: returns US dollars per metric ton ✓
      const usdPerKgAl = value / TONNE_TO_KG;
      return usdPerKgAl * FX_RATES.USD_to_NGN;

    default:
      return value;
  }
}

// Convert Excel purchase price to NGN/kg
function convertExcelPriceToNGNPerKg(commodity, excelItem) {
  if (!excelItem) return null;
  
  switch(commodity) {
    case 'wheat':
      if (excelItem.currency === 'USD') {
        return excelItem.rate * FX_RATES.USD_to_NGN;
      } else if (excelItem.currency === 'GHS') {
        const usdRate = excelItem.rate * FX_RATES.GHS_to_USD;
        return usdRate * FX_RATES.USD_to_NGN;
      }
      return excelItem.rate;
      
    case 'palm':
      if (excelItem.currency === 'GHS') {
        const usdRate = excelItem.rate * FX_RATES.GHS_to_USD;
        return usdRate * FX_RATES.USD_to_NGN;
      }
      return excelItem.rate;
      
    case 'crude_palm':
      if (excelItem.currency === 'USD') {
        return excelItem.rate * FX_RATES.USD_to_NGN;
      }
      return excelItem.rate;
      
    case 'sugar':
      return excelItem.cost;
      
    case 'aluminum':
      const usdPerKg = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE / TONNE_TO_KG;
      return usdPerKg * FX_RATES.USD_to_NGN;
      
    default:
      return null;
  }
}

// Get Excel date for month grouping
function getExcelDateForMonth(commodity, excelItem) {
  switch(commodity) {
    case 'wheat':
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

// Process Excel data by month (average per month)
function processExcelDataByMonth(commodity) {
  const rawData = EXCEL_DATA_SOURCES[commodity] || [];
  
  console.log(`Processing ${commodity} data:`, {
    rawDataLength: rawData.length,
    sampleItems: rawData.slice(0, 3)
  });
  
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
    
    // Only keep data from 2020 onwards
    if (year < 2020 || year > currentYear + 1) {
      console.warn(`Skipping unrealistic year for ${commodity}:`, monthKey, 'from date:', dateStr);
      return;
    }
    
    const ngnPerKg = convertExcelPriceToNGNPerKg(commodity, item);
    if (ngnPerKg == null) return;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        monthKey,
        values: [],
        dates: []
      };
    }
    
    monthlyData[monthKey].values.push(ngnPerKg);
    monthlyData[monthKey].dates.push(dateStr);
  });
  
  const result = Object.values(monthlyData).map(month => ({
    monthKey: month.monthKey,
    monthDisplay: getMonthDisplay(month.monthKey),
    excelPrice: month.values.reduce((sum, val) => sum + val, 0) / month.values.length,
    transactionCount: month.values.length,
    dates: month.dates
  })).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  
  const filteredResult = filterRecentData(result, 5);
  
  console.log(`${commodity} processed data:`, {
    totalMonths: result.length,
    filteredMonths: filteredResult.length,
    months: filteredResult.map(m => m.monthKey)
  });
  
  return filteredResult;
}

// REAL API FUNCTION for DDFPlus - fetch daily data and aggregate by month
// REAL API FUNCTION for DDFPlus - fetch daily data and aggregate by month
async function fetchCommodityDataForMonths(symbol, months) {
  try {
    const monthlyResults = [];
    
    // Filter months to only recent ones (2020 onwards)
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
          
          // Log first few lines to debug
          if (index < 3) {
            console.log(`Line ${index} for ${month}:`, parts);
          }
          
          // CSV format: Symbol,Date,Open,High,Low,Close,Volume,OpenInterest
          if (parts.length >= 6) {
            const dateStr = parts[1]; // Date is at index 1
            const closePrice = parseFloat(parts[5]); // Close is at index 5
            
            // Verify this date belongs to the requested month
            const date = new Date(dateStr);
            const lineMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (lineMonthKey === month && !isNaN(closePrice) && closePrice > 0) {
              dailyPrices.push({
                date: dateStr,
                price: closePrice
              });
              
              if (index < 3) {
                console.log(`  Added: ${dateStr} - ${closePrice}`);
              }
            }
          }
        });
        
        if (dailyPrices.length > 0) {
          // Calculate monthly average
          const sum = dailyPrices.reduce((sum, day) => sum + day.price, 0);
          const monthlyAvg = sum / dailyPrices.length;
          
          monthlyResults.push({
            monthKey: month,
            avgPrice: monthlyAvg,
            dataPoints: dailyPrices.length,
            sampleDates: dailyPrices.slice(0, 3).map(d => d.date) // For debugging
          });
          
          console.log(`✅ ${month} for ${symbol}: ${dailyPrices.length} trading days, avg: ${monthlyAvg.toFixed(2)}`);
          console.log(`   Sample prices: ${dailyPrices.slice(0, 3).map(d => d.price.toFixed(2)).join(', ')}...`);
        } else {
          console.warn(`No valid daily prices for ${month} - ${symbol}`);
          console.log(`   Raw text sample: ${text.substring(0, 200)}...`);
        }
        
      } catch (fetchError) {
        console.error(`Error fetching ${month} for ${symbol}:`, fetchError);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    console.log(`Total monthly results for ${symbol}:`, monthlyResults.map(r => ({
      month: r.monthKey,
      avg: r.avgPrice?.toFixed(2),
      days: r.dataPoints
    })));
    
    return monthlyResults;
    
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return [];
  }
}

// NEW: Fetch monthly prices with better variation detection
async function fetchMonthlyPricesWithVariation(symbol, months) {
  try {
    const monthlyResults = await fetchCommodityDataForMonths(symbol, months);
    
    // If we have no data, return empty
    if (monthlyResults.length === 0) {
      console.warn(`No API data for ${symbol}`);
      return [];
    }
    
    // Check if all prices are the same (API returning constant values)
    const allPrices = monthlyResults.map(r => r.avgPrice);
    const uniquePrices = [...new Set(allPrices.map(p => p.toFixed(2)))];
    
    if (uniquePrices.length === 1) {
      console.warn(`⚠️ API returning constant prices for ${symbol}: ${uniquePrices[0]}`);
      
      // Try fetching a longer time range to get variation
      console.log(`Trying to fetch more data for ${symbol} to get variation...`);
      
      // Fetch last 2 years of daily data to calculate realistic monthly averages
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 2);
      
      const startStr = formatDateForAPI(startDate);
      const endStr = formatDateForAPI(endDate);
      
      const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${startStr}&enddate=${endStr}`;
      
      try {
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          if (text && !text.includes('error') && !text.includes('No data')) {
            const lines = text.trim().split('\n').filter(line => line.trim() && !line.includes('error'));
            
            const allDailyData = [];
            lines.forEach(line => {
              const parts = line.split(',').map(p => p.trim());
              if (parts.length >= 6) {
                const date = parts[0];
                const closePrice = parseFloat(parts[5]);
                if (!isNaN(closePrice) && closePrice > 0) {
                  allDailyData.push({ date, price: closePrice });
                }
              }
            });
            
            if (allDailyData.length > 0) {
              // Group by month and calculate averages
              const monthlyAverages = {};
              allDailyData.forEach(item => {
                const date = new Date(item.date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!monthlyAverages[monthKey]) {
                  monthlyAverages[monthKey] = {
                    prices: [],
                    count: 0
                  };
                }
                monthlyAverages[monthKey].prices.push(item.price);
                monthlyAverages[monthKey].count++;
              });
              
              // Update monthly results with real variation
              const updatedResults = monthlyResults.map(monthResult => {
                const monthData = monthlyAverages[monthResult.monthKey];
                if (monthData && monthData.prices.length > 0) {
                  const realAvg = monthData.prices.reduce((sum, p) => sum + p, 0) / monthData.prices.length;
                  console.log(`Updated ${monthResult.monthKey} from ${monthResult.avgPrice} to ${realAvg}`);
                  return {
                    ...monthResult,
                    avgPrice: realAvg,
                    dataPoints: monthData.count,
                    source: 'real_variation'
                  };
                }
                return monthResult;
              });
              
              return updatedResults;
            }
          }
        }
      } catch (e) {
        console.error(`Error fetching variation data for ${symbol}:`, e);
      }
    }
    
    return monthlyResults;
    
  } catch (error) {
    console.error(`Error in fetchMonthlyPricesWithVariation for ${symbol}:`, error);
    return [];
  }
}

// Fetch daily prices for a commodity
// Fetch daily prices for a commodity
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
        // CSV format: Symbol,Date,Open,High,Low,Close,Volume,OpenInterest
        const symbol = parts[0];
        const date = parts[1]; // Date is at index 1
        const closePrice = parseFloat(parts[5]); // Close is at index 5
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

// Fetch current price with weekly and yearly data
async function fetchCurrentPriceWithHistory(symbol) {
  try {
    // Fetch last 30 days for current, weekly, and monthly data
    const dailyData = await fetchDailyPrices(symbol, 365); // Get 1 year for better calculations
    
    if (dailyData.length === 0) {
      console.warn(`No daily data for ${symbol}`);
      return null;
    }
    
    // Get the latest price (today)
    const latest = dailyData[dailyData.length - 1];
    
    // Get price from 7 days ago (weekly comparison)
    const weekAgoIndex = Math.max(0, dailyData.length - 8);
    const weekAgo = dailyData[weekAgoIndex];
    
    // Get price from 30 days ago (monthly comparison)
    const monthAgoIndex = Math.max(0, dailyData.length - 31);
    const monthAgo = dailyData[monthAgoIndex];
    
    // Get price from 365 days ago (yearly comparison)
    const yearAgoIndex = Math.max(0, dailyData.length - 366);
    const yearAgo = dailyData[yearAgoIndex];
    
    console.log(`Price history for ${symbol}:`, {
      latest: latest?.price,
      weekAgo: weekAgo?.price,
      monthAgo: monthAgo?.price,
      yearAgo: yearAgo?.price
    });
    
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

// Calculate percentage change
function calculatePercentageChange(current, previous) {
  if (!previous || previous === 0 || !current) return null;
  return ((current - previous) / previous) * 100;
}

// Process API data by month
function processApiDataByMonth(commodity, apiMonthlyData) {
  return apiMonthlyData.map(item => ({
    monthKey: item.monthKey,
    monthDisplay: getMonthDisplay(item.monthKey),
    apiPrice: convertApiValueToNGNPerKg(commodity, item.avgPrice),
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
      apiSource: apiMonth?.source || 'none'
    };
  });
}

const CommodityDashboard = () => {
  const [selectedCommodity, setSelectedCommodity] = useState('wheat');
  const [commodityData, setCommodityData] = useState({});
  const [monthlyComparisonData, setMonthlyComparisonData] = useState({});
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingLivePrices, setLoadingLivePrices] = useState(false);
  const [error, setError] = useState('');
  const [dataDebug, setDataDebug] = useState('');
  const [apiStatus, setApiStatus] = useState('connecting');

  // Process Excel data by month (static, doesn't need API)
  const excelMonthlyData = useMemo(() => {
    console.log('Processing Excel data for all commodities...');
    const data = {};
    Object.keys(COMMODITY_CONFIG).forEach(commodity => {
      data[commodity] = processExcelDataByMonth(commodity);
    });
    
    // For aluminum, create monthly data with negotiated price
    if (!data.aluminum || data.aluminum.length === 0) {
      const months = [];
      const currentDate = new Date();
      const startDate = new Date(2020, 0, 1);
      
      for (let d = new Date(startDate); d <= currentDate; d.setMonth(d.getMonth() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        
        const usdPerKg = NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE / TONNE_TO_KG;
        const ngnPerKg = usdPerKg * FX_RATES.USD_to_NGN;
        
        months.push({
          monthKey,
          monthDisplay: getMonthDisplay(monthKey),
          excelPrice: ngnPerKg,
          transactionCount: 1,
          dates: [monthKey]
        });
      }
      
      data.aluminum = months;
      console.log('Generated aluminum data with negotiated price:', months.length, 'months');
    }
    
    // Log data summary
    Object.keys(data).forEach(commodity => {
      console.log(`${commodity} Excel months:`, data[commodity].length);
      if (data[commodity].length > 0) {
        console.log(`${commodity} date range:`, 
          data[commodity][0]?.monthKey, 'to', 
          data[commodity][data[commodity].length - 1]?.monthKey
        );
      }
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
          
          // Convert all prices to NGN/kg
          const currentNGN = convertApiValueToNGNPerKg(commodity, priceData.current);
          const previousNGN = priceData.previous ? convertApiValueToNGNPerKg(commodity, priceData.previous) : null;
          const weekAgoNGN = priceData.weekAgo ? convertApiValueToNGNPerKg(commodity, priceData.weekAgo) : null;
          const monthAgoNGN = priceData.monthAgo ? convertApiValueToNGNPerKg(commodity, priceData.monthAgo) : null;
          const yearAgoNGN = priceData.yearAgo ? convertApiValueToNGNPerKg(commodity, priceData.yearAgo) : null;
          
          // Calculate percentages
          const percentages = {
            day: previousNGN ? calculatePercentageChange(currentNGN, previousNGN) : null,
            week: weekAgoNGN ? calculatePercentageChange(currentNGN, weekAgoNGN) : null,
            month: monthAgoNGN ? calculatePercentageChange(currentNGN, monthAgoNGN) : null,
            year: yearAgoNGN ? calculatePercentageChange(currentNGN, yearAgoNGN) : null
          };
          
          liveData[commodity] = {
            current: currentNGN,
            previous: previousNGN,
            weekAgo: weekAgoNGN,
            monthAgo: monthAgoNGN,
            yearAgo: yearAgoNGN,
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
          
          console.log(`Live price for ${commodity}:`, {
            currentNGN,
            percentages
          });
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        setLivePrices(liveData);
        setApiStatus('connected');
        
      } catch (error) {
        console.error('Error fetching live prices:', error);
        setApiStatus('error');
        
        // Set empty data
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
    
    // Refresh live prices every 5 minutes
    const intervalId = setInterval(fetchLivePrices, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Fetch API data and combine with Excel data
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
          
          // Fetch REAL API data with variation detection
          const apiMonthlyRaw = await fetchMonthlyPricesWithVariation(symbol, excelMonths);
          
          console.log(`API results for ${commodity}:`, apiMonthlyRaw.map(r => ({
            month: r.monthKey,
            price: r.avgPrice,
            source: r.source || 'api'
          })));
          
          const apiMonthly = processApiDataByMonth(commodity, apiMonthlyRaw);
          const combinedData = combineMonthlyData(excelMonthly, apiMonthly);
          
          // Check if API data has variation
          const apiPrices = combinedData.filter(d => d.apiPrice).map(d => d.apiPrice);
          const uniquePrices = [...new Set(apiPrices.map(p => p.toFixed(2)))];
          const hasVariation = uniquePrices.length > 1;
          
          console.log(`Combined data for ${commodity}:`, {
            totalMonths: combinedData.length,
            excelDataPoints: combinedData.filter(d => d.excelPrice).length,
            apiDataPoints: combinedData.filter(d => d.apiPrice).length,
            hasVariation,
            uniquePrices: uniquePrices.length,
            dateRange: combinedData.length > 0 ? 
              `${combinedData[0].monthKey} to ${combinedData[combinedData.length - 1].monthKey}` : 
              'No data'
          });
          
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
        
        // Calculate API data availability and variation
        const apiDataSummary = Object.keys(comparisonObj).map(commodity => {
          const data = comparisonObj[commodity];
          const apiMonths = data.filter(d => d.apiPrice != null).length;
          const totalMonths = data.length;
          const apiPrices = data.filter(d => d.apiPrice).map(d => d.apiPrice);
          const uniquePrices = [...new Set(apiPrices.map(p => p.toFixed(2)))];
          const hasVariation = uniquePrices.length > 1;
          
          return `${commodity}: ${apiMonths}/${totalMonths} ${hasVariation ? '✓' : '⚠️'}`;
        }).join(' | ');
        
        setDataDebug(`API Data: ${apiDataSummary}`);
        setApiStatus('connected');
        
      } catch (err) {
        console.error('Error in fetchAllCommodityData:', err);
        setError(`Failed to fetch data: ${err.message}. Please check your API connection.`);
        setApiStatus('error');
        
        // Set empty data on error
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
    
    // Refresh data every 10 minutes
    const intervalId = setInterval(fetchAllCommodityData, 10 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [excelMonthlyData]);

  // Prepare chart data for selected commodity
  const prepareChartData = () => {
    const data = monthlyComparisonData[selectedCommodity] || [];
    const filteredData = data.filter(item => item.excelPrice != null);
    
    console.log(`Chart data for ${selectedCommodity}:`, filteredData.map(d => ({
      month: d.monthKey,
      excelPrice: d.excelPrice,
      apiPrice: d.apiPrice,
      source: d.apiSource
    })));
    
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

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    const config = COMMODITY_CONFIG[selectedCommodity];
    const dec = decimalsByCommodity[selectedCommodity] || 2;

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
              {data.excelPrice.toFixed(dec)} NGN/kg
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
                {data.apiPrice.toFixed(dec)} NGN/kg
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
                {Math.abs(data.excelPrice - data.apiPrice).toFixed(dec)} NGN/kg
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
              Monthly Averages: Our Purchases (Blue) vs Market Prices (Green) | All in NGN/kg
            </div>
          </div>
          
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
        <strong>API Status:</strong> {dataDebug || 'Loading...'} | <strong>Mode:</strong> Real API Only
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
        {Object.keys(COMMODITY_CONFIG).map(commodity => {
          const config = COMMODITY_CONFIG[commodity];
          const isSelected = selectedCommodity === commodity;
          const comparisonData = monthlyComparisonData[commodity] || [];
          const monthsWithExcelData = comparisonData.filter(item => item.excelPrice != null).length;
          const monthsWithApiData = comparisonData.filter(item => item.apiPrice != null).length;
          const apiCoverage = monthsWithExcelData > 0 ? Math.round((monthsWithApiData / monthsWithExcelData) * 100) : 0;
          const apiPrices = comparisonData.filter(item => item.apiPrice).map(item => item.apiPrice);
          const uniquePrices = [...new Set(apiPrices.map(p => p?.toFixed(2)))];
          const hasVariation = uniquePrices.length > 1;
          
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
                minWidth: '160px',
                position: 'relative'
              }}
            >
              <span style={{ fontSize: '18px' }}>{config.icon}</span>
              <span>{config.name}</span>
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
            {Object.keys(COMMODITY_CONFIG).map(commodity => {
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
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>{config.name}</span>
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
                          ⚠️ Constant API prices detected
                        </div>
                      )}
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
                      <div>~{(NEGOTIATED_ALUMINUM_PRICE_USD_PER_TONNE / TONNE_TO_KG * FX_RATES.USD_to_NGN).toFixed(2)} NGN/kg</div>
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
              <span style={{ fontWeight: 600, fontSize: '16px', color: '#0369a1' }}>How It Works</span>
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
                    : 'Your company\'s actual purchase prices from Excel'}
                </div>
              </div>
              <div>
                <div style={{ color: '#10B981', fontWeight: 600, marginBottom: '4px' }}>Green Line (Market Price)</div>
                <div style={{ color: '#374151' }}>
                  Real-time market prices from DDFPlus commodity API
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    ⚠️ If API returns constant values, system tries to fetch variation
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>
              Note: Only real API data is shown. System detects and adjusts for constant API responses.
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
                  ? 'Negotiated raw material price vs Real market prices (2020-2025)' 
                  : 'Our purchase prices vs Real market prices (2020-2025)'}
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
                <div style={{ width: '10px', height: '3px', backgroundColor: '#3B82F6' }}></div>
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
                    tickFormatter={value => `${value.toFixed(decimalsByCommodity[selectedCommodity])}`}
                    tick={{ fontSize: 12 }}
                    label={{ 
                      value: 'NGN/kg',
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

          {/* LIVE PRICES TABLE - WITH WEEK AND YEAR COLUMNS */}
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
                  Real-time market prices from DDFPlus API in NGN/kg (Refreshing every 5 minutes)
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
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Yesterday</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Day %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Week Ago</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Week %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Month Ago</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Month %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Year Ago</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Year %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(COMMODITY_CONFIG).map((commodity, index) => {
                      const config = COMMODITY_CONFIG[commodity];
                      const liveData = livePrices[commodity];
                      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                      
                      if (!liveData) return null;
                      
                      const dec = decimalsByCommodity[commodity] || 2;
                      const hasData = liveData.current !== null;
                      const statusColor = hasData ? '#059669' : '#dc2626';
                      const statusText = hasData ? 'Live' : 'No Data';
                      
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
                          
                          {/* Yesterday */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            color: hasData ? '#6b7280' : '#9ca3af'
                          }}>
                            {hasData ? (liveData.previous?.toFixed(dec) || '—') : '—'}
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
                          
                          {/* Year Ago */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            color: hasData && liveData.yearAgo ? '#6b7280' : '#9ca3af'
                          }}>
                            {hasData && liveData.yearAgo ? liveData.yearAgo.toFixed(dec) : '—'}
                          </td>
                          
                          {/* Year % */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {hasData && liveData.percentages?.year !== null ? (
                              <span style={{
                                fontWeight: '600',
                                color: liveData.percentages.year >= 0 ? '#059669' : '#dc2626',
                                backgroundColor: liveData.percentages.year >= 0 ? '#d1fae5' : '#fee2e2',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}>
                                {liveData.percentages.year >= 0 ? '▲' : '▼'} {Math.abs(liveData.percentages.year).toFixed(2)}%
                              </span>
                            ) : '—'}
                          </td>
                          
                          {/* Status */}
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
                      // Refresh live prices function
                      setLoadingLivePrices(true);
                      // You would need to implement a refresh function here
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
              • FX Rates: USD/NGN 1650<br/>
              • Dates: 2020-2025 only
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Legend</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • <span style={{ color: '#3B82F6' }}>Blue</span>: Our purchase prices<br/>
              • <span style={{ color: '#10B981' }}>Green</span>: Market prices (API)<br/>
              • <span style={{ color: '#f59e0b' }}>Yellow warning</span>: Constant API prices<br/>
              • Dashed line: Missing API data
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Refresh Schedule</div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              • Live prices: Every 5 minutes<br/>
              • Historical data: Every 10 minutes<br/>
              • Last API check: {new Date().toLocaleTimeString()}<br/>
              • Mode: Real API Only
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommodityDashboard;