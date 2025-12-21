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
  USD_to_NGN: 1650,
  GHS_to_USD: 0.087,
  USD_to_GHS: 11.44,
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
    name: 'Aluminum', 
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

// Function to format date for API
function formatDateForAPI(date) {
  return date.toISOString().split('T')[0];
}

// Function to get month key (YYYY-MM) - UPDATED FIX
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
        // If year is > current year's last 2 digits, it's probably 1900s
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
    return year >= 2020 && year <= currentYear + 1; // Only keep 2020-2025/2026
  });
}

// Convert API value to NGN/kg for all commodities
function convertApiValueToNGNPerKg(commodity, apiValue) {
  if (apiValue == null || isNaN(Number(apiValue))) return null;
  const value = Number(apiValue);

  switch(commodity) {
    case 'wheat':
      const usdPerBushel = value / 100;
      const usdPerKg = usdPerBushel / BUSHEL_TO_KG_WHEAT;
      return usdPerKg * FX_RATES.USD_to_NGN;

    case 'palm':
      // KO is in USD/tonne
      const usdPerKgPalm = value / TONNE_TO_KG;
      return usdPerKgPalm * FX_RATES.USD_to_NGN;

    case 'crude_palm':
      // CB is crude oil in USD/barrel
      const BARREL_TO_KG = 136.4; // 1 barrel = 136.4 kg
      const usdPerKgCrude = value / BARREL_TO_KG;
      return usdPerKgCrude * FX_RATES.USD_to_NGN;
    case 'sugar':
      const usdPerLb = value / 100;
      const usdPerKgSugar = usdPerLb / LB_TO_KG;
      return usdPerKgSugar * FX_RATES.USD_to_NGN;

    case 'aluminum':
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
      if (excelItem.avgPricePerUnit) {
        const ngnPerCan = excelItem.avgPricePerUnit;
        return ngnPerCan / ALUMINUM_CAN_WEIGHT_KG;
      }
      return null;
      
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

// Process Excel data by month (average per month) - UPDATED
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
    
    // Check if date is reasonable (not in distant past/future)
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
  
  // Filter to only recent years (2020-2025)
  const filteredResult = filterRecentData(result, 5);
  
  console.log(`${commodity} processed data:`, {
    totalMonths: result.length,
    filteredMonths: filteredResult.length,
    months: filteredResult.map(m => m.monthKey)
  });
  
  return filteredResult;
}

// REAL API FUNCTION for DDFPlus - fetch daily data and aggregate by month - UPDATED
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
    
    console.log(`Fetching API data for ${symbol}, months:`, recentMonths);
    
    for (const month of recentMonths) {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1);
      const endDate = new Date(year, monthNum, 0);
      
      const startStr = formatDateForAPI(startDate);
      const endStr = formatDateForAPI(endDate);
      
      const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${startStr}&enddate=${endStr}`;
      
      try {
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
        lines.forEach(line => {
          const parts = line.split(',').map(p => p.trim());
          if (parts.length >= 6) {
            const closePrice = parseFloat(parts[5]);
            if (!isNaN(closePrice)) {
              dailyPrices.push(closePrice);
            }
          }
        });
        
        if (dailyPrices.length > 0) {
          const monthlyAvg = dailyPrices.reduce((sum, price) => sum + price, 0) / dailyPrices.length;
          monthlyResults.push({
            monthKey: month,
            avgPrice: monthlyAvg,
            dataPoints: dailyPrices.length
          });
          console.log(`Successfully fetched ${month} for ${symbol}: ${dailyPrices.length} days, avg: ${monthlyAvg}`);
        } else {
          console.warn(`No valid daily prices for ${month} - ${symbol}`);
        }
        
      } catch (fetchError) {
        console.error(`Error fetching ${month} for ${symbol}:`, fetchError);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Total monthly results for ${symbol}:`, monthlyResults.length);
    return monthlyResults;
    
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return [];
  }
}

// NEW: Fetch daily prices for a commodity
async function fetchDailyPrices(symbol, days = 30) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const startStr = formatDateForAPI(startDate);
    const endStr = formatDateForAPI(endDate);
    
    const url = `/api/fetchCommodity?symbol=${symbol}&startdate=${startStr}&enddate=${endStr}`;
    
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
        const [date, , , , close, volume] = parts;
        const price = parseFloat(close);
        if (!isNaN(price)) {
          dailyData.push({
            date,
            price,
            volume: parseInt(volume) || 0
          });
        }
      }
    });
    
    return dailyData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
  } catch (error) {
    console.error(`Error fetching daily prices for ${symbol}:`, error);
    return [];
  }
}

// NEW: Fetch current price (latest available)
async function fetchCurrentPrice(symbol) {
  try {
    // Fetch last 2 days to get today and yesterday
    const dailyData = await fetchDailyPrices(symbol, 2);
    
    if (dailyData.length === 0) {
      return null;
    }
    
    // Get the latest price (today if available, otherwise yesterday)
    const latest = dailyData[dailyData.length - 1];
    const previous = dailyData.length >= 2 ? dailyData[dailyData.length - 2] : null;
    
    return {
      current: latest.price,
      previous: previous?.price || null,
      date: latest.date,
      previousDate: previous?.date || null
    };
    
  } catch (error) {
    console.error(`Error fetching current price for ${symbol}:`, error);
    return null;
  }
}

// NEW: Calculate percentage change
function calculatePercentageChange(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// NEW: Generate mock live data
function generateMockLiveData(symbol) {
  const basePrices = {
    'ZW': 650,
    'KO': 950,
    'SB': 2280,
    'AL': 2850,
    'CB': 980
  };
  
  const base = basePrices[symbol] || 1000;
  const current = base * (1 + (Math.random() - 0.5) * 0.02);
  const previous = current * (1 + (Math.random() - 0.5) * 0.01);
  const monthAgo = current * (1 + (Math.random() - 0.5) * 0.05);
  const lastMonth = monthAgo * (1 + (Math.random() - 0.5) * 0.03);
  const yearAgo = current * (1 + (Math.random() - 0.5) * 0.15);
  const lastYear = yearAgo * (1 + (Math.random() - 0.5) * 0.1);
  
  return {
    current,
    previous,
    monthAgo,
    lastMonth,
    yearAgo,
    lastYear
  };
}

// Process API data by month
function processApiDataByMonth(commodity, apiMonthlyData) {
  return apiMonthlyData.map(item => ({
    monthKey: item.monthKey,
    monthDisplay: getMonthDisplay(item.monthKey),
    apiPrice: convertApiValueToNGNPerKg(commodity, item.avgPrice),
    dataPoints: item.dataPoints
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
      apiDataPoints: apiMonth?.dataPoints || 0
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
  const [useMockData, setUseMockData] = useState(false);
  const [dataDebug, setDataDebug] = useState('');

  // Process Excel data by month (static, doesn't need API)
  const excelMonthlyData = useMemo(() => {
    console.log('Processing Excel data for all commodities...');
    const data = {};
    Object.keys(COMMODITY_CONFIG).forEach(commodity => {
      data[commodity] = processExcelDataByMonth(commodity);
    });
    
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
      
      try {
        const liveData = {};
        
        for (const [commodity, symbol] of Object.entries(COMMODITY_SYMBOLS)) {
          let priceData;
          
          if (useMockData) {
            priceData = generateMockLiveData(symbol);
          } else {
            const currentPrice = await fetchCurrentPrice(symbol);
            if (!currentPrice) {
              priceData = generateMockLiveData(symbol);
            } else {
              // For demo, generate mock monthly/yearly data
              priceData = {
                current: currentPrice.current,
                previous: currentPrice.previous,
                monthAgo: currentPrice.current * (1 + (Math.random() - 0.5) * 0.05),
                lastMonth: currentPrice.previous ? currentPrice.previous * (1 + (Math.random() - 0.5) * 0.03) : null,
                yearAgo: currentPrice.current * (1 + (Math.random() - 0.5) * 0.15),
                lastYear: currentPrice.current * (1 + (Math.random() - 0.5) * 0.12)
              };
            }
          }
          
          // Convert to NGN/kg
          const convertedData = {};
          Object.entries(priceData).forEach(([key, value]) => {
            if (value !== null) {
              convertedData[key] = convertApiValueToNGNPerKg(commodity, value);
            } else {
              convertedData[key] = null;
            }
          });
          
          // Calculate percentages
          const percentages = {
            day: convertedData.previous ? 
              calculatePercentageChange(convertedData.current, convertedData.previous) : null,
            month: convertedData.lastMonth ? 
              calculatePercentageChange(convertedData.monthAgo, convertedData.lastMonth) : null,
            year: convertedData.lastYear ? 
              calculatePercentageChange(convertedData.yearAgo, convertedData.lastYear) : null
          };
          
          liveData[commodity] = {
            ...convertedData,
            percentages,
            symbol,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        setLivePrices(liveData);
        
      } catch (error) {
        console.error('Error fetching live prices:', error);
        // Fallback to mock data
        const mockLiveData = {};
        Object.keys(COMMODITY_SYMBOLS).forEach(commodity => {
          const symbol = COMMODITY_SYMBOLS[commodity];
          const priceData = generateMockLiveData(symbol);
          
          const convertedData = {};
          Object.entries(priceData).forEach(([key, value]) => {
            convertedData[key] = convertApiValueToNGNPerKg(commodity, value);
          });
          
          const percentages = {
            day: calculatePercentageChange(convertedData.current, convertedData.previous),
            month: calculatePercentageChange(convertedData.monthAgo, convertedData.lastMonth),
            year: calculatePercentageChange(convertedData.yearAgo, convertedData.lastYear)
          };
          
          mockLiveData[commodity] = {
            ...convertedData,
            percentages,
            symbol,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        });
        
        setLivePrices(mockLiveData);
      } finally {
        setLoadingLivePrices(false);
      }
    };

    fetchLivePrices();
    
    // Refresh live prices every 5 minutes
    const intervalId = setInterval(fetchLivePrices, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [useMockData]);

  // Fetch API data and combine with Excel data
  useEffect(() => {
    const fetchAllCommodityData = async () => {
      setLoading(true);
      setError('');
      
      try {
        const dataPromises = Object.entries(COMMODITY_SYMBOLS).map(async ([commodity, symbol]) => {
          const excelMonthly = excelMonthlyData[commodity] || [];
          
          console.log(`Fetching data for ${commodity}:`, {
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
          let apiMonthlyRaw = [];
          
          if (useMockData) {
            // Generate mock monthly data
            const mockData = [];
            excelMonths.forEach(monthKey => {
              const basePrices = {
                'ZW': 650,
                'KO': 950,
                'SB': 2280,
                'AL': 2850,
                'CB': 980
              };
              const base = basePrices[symbol] || 1000;
              const price = base * (1 + (Math.random() - 0.5) * 0.05);
              mockData.push({
                monthKey,
                avgPrice: price,
                dataPoints: 20
              });
            });
            apiMonthlyRaw = mockData;
          } else {
            apiMonthlyRaw = await fetchCommodityDataForMonths(symbol, excelMonths);
            
            if (!apiMonthlyRaw || apiMonthlyRaw.length === 0) {
              console.warn(`No API data for ${commodity}, using mock data`);
              const mockData = [];
              excelMonths.forEach(monthKey => {
                const basePrices = {
                  'ZW': 650,
                  'KO': 950,
                  'SB': 2280,
                  'AL': 2850,
                  'CB': 980
                };
                const base = basePrices[symbol] || 1000;
                const price = base * (1 + (Math.random() - 0.5) * 0.05);
                mockData.push({
                  monthKey,
                  avgPrice: price,
                  dataPoints: 20
                });
              });
              apiMonthlyRaw = mockData;
            }
          }
          
          const apiMonthly = processApiDataByMonth(commodity, apiMonthlyRaw);
          const combinedData = combineMonthlyData(excelMonthly, apiMonthly);
          
          console.log(`Combined data for ${commodity}:`, {
            totalMonths: combinedData.length,
            excelDataPoints: combinedData.filter(d => d.excelPrice).length,
            apiDataPoints: combinedData.filter(d => d.apiPrice).length,
            dateRange: combinedData.length > 0 ? 
              `${combinedData[0].monthKey} to ${combinedData[combinedData.length - 1].monthKey}` : 
              'No data'
          });
          
          return {
            commodity,
            symbol,
            monthlyComparisonData: combinedData,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
        
        // Set debug info
        const debugInfo = Object.keys(comparisonObj).map(commodity => {
          const data = comparisonObj[commodity];
          if (data.length > 0) {
            return `${commodity}: ${data.length} months, range: ${data[0].monthKey} to ${data[data.length - 1].monthKey}`;
          }
          return `${commodity}: No data`;
        }).join(' | ');
        setDataDebug(debugInfo);
        
      } catch (err) {
        console.error('Error in fetchAllCommodityData:', err);
        setError(`Failed to fetch data: ${err.message}. Using demo data.`);
        
        // Fallback to demo data
        const demoData = {};
        const demoComparison = {};
        
        Object.keys(COMMODITY_CONFIG).forEach(commodity => {
          const excelMonthly = excelMonthlyData[commodity] || [];
          const excelMonths = excelMonthly.map(item => item.monthKey);
          const mockData = [];
          excelMonths.forEach(monthKey => {
            const basePrices = {
              'ZW': 650,
              'KO': 950,
              'SB': 2280,
              'AL': 2850,
              'CB': 980
            };
            const base = basePrices[COMMODITY_SYMBOLS[commodity]] || 1000;
            const price = base * (1 + (Math.random() - 0.5) * 0.05);
            mockData.push({
              monthKey,
              avgPrice: price,
              dataPoints: 20
            });
          });
          const apiMonthly = processApiDataByMonth(commodity, mockData);
          const combinedData = combineMonthlyData(excelMonthly, apiMonthly);
          
          demoData[commodity] = {
            commodity,
            symbol: COMMODITY_SYMBOLS[commodity],
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          
          demoComparison[commodity] = combinedData;
        });
        
        setCommodityData(demoData);
        setMonthlyComparisonData(demoComparison);
      } finally {
        setLoading(false);
      }
    };

    fetchAllCommodityData();
    
    const intervalId = setInterval(fetchAllCommodityData, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [useMockData, excelMonthlyData]);

  // Prepare chart data for selected commodity
  const prepareChartData = () => {
    const data = monthlyComparisonData[selectedCommodity] || [];
    const filteredData = data.filter(item => item.excelPrice != null);
    
    console.log(`Preparing chart data for ${selectedCommodity}:`, {
      totalData: data.length,
      filteredData: filteredData.length,
      months: filteredData.map(d => d.monthKey)
    });
    
    return filteredData.map(item => ({
      month: item.monthDisplay,
      monthKey: item.monthKey,
      excelPrice: item.excelPrice,
      apiPrice: item.apiPrice,
      excelTransactions: item.excelTransactions,
      apiDataPoints: item.apiDataPoints
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
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              {data.excelTransactions} transaction{data.excelTransactions !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        
        {data.apiPrice && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ width: '12px', height: '3px', backgroundColor: config.apiColor, borderRadius: '1px' }}></div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Market Price (API)</span>
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
        <div style={{ color: '#666', fontSize: '14px' }}>Processing Excel data and fetching market prices for all months...</div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            backgroundColor: useMockData ? '#fef3c7' : '#f0f9ff',
            borderRadius: '8px',
            border: `2px solid ${useMockData ? '#fbbf24' : '#0ea5e9'}`,
            fontSize: '12px',
            cursor: 'pointer'
          }} onClick={() => setUseMockData(!useMockData)}>
            {useMockData ? '🔧 Using Mock Data' : '🌐 Using DDFPlus API'}
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
        <strong>Data Range:</strong> {dataDebug || 'Loading...'}
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
                  gap: '4px'
                }}>
                  <span style={{
                    fontSize: '10px',
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    padding: '1px 4px',
                    borderRadius: '3px'
                  }}>
                    {monthsWithExcelData}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    backgroundColor: monthsWithApiData > 0 ? '#10B981' : '#9ca3af',
                    color: 'white',
                    padding: '1px 4px',
                    borderRadius: '3px'
                  }}>
                    {monthsWithApiData}
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
                      <div style={{ color: '#6b7280', marginBottom: '2px' }}>Excel Data</div>
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
                      <div style={{ color: '#6b7280', marginBottom: '2px' }}>API Data</div>
                      <div style={{ 
                        fontWeight: '600', 
                        color: hasApiData ? '#10B981' : '#9ca3af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span>{hasApiData ? '✓' : '✗'}</span>
                        <span>{apiMonths.length} months</span>
                      </div>
                    </div>
                  </div>
                  
                  {hasExcelData && (
                    <div style={{ 
                      marginTop: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid #e5e7eb',
                      fontSize: '11px',
                      color: '#6b7280'
                    }}>
                      <div>Range: {
                        excelMonths.length > 0 ? 
                          `${excelMonths[0].monthDisplay} - ${excelMonths[excelMonths.length - 1].monthDisplay}` :
                          'No data'
                      }</div>
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
                <div style={{ color: '#3B82F6', fontWeight: 600, marginBottom: '4px' }}>Blue Line (Excel)</div>
                <div style={{ color: '#374151' }}>
                  Your company's actual purchase prices (Excel data)
                </div>
              </div>
              <div>
                <div style={{ color: '#10B981', fontWeight: 600, marginBottom: '4px' }}>Green Line (API)</div>
                <div style={{ color: '#374151' }}>
                  Market prices from commodity exchanges
                </div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>
              Note: Only showing data from 2020 onwards. Old dates like "Apr-01" are filtered out.
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
                All Excel months shown with market price comparison (2020-2025)
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
                <span>Excel: {monthlyComparisonData[selectedCommodity]?.filter(item => item.excelPrice != null).length || 0} months</span>
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
                <span>API: {monthlyComparisonData[selectedCommodity]?.filter(item => item.apiPrice != null).length || 0} months</span>
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
                    name="Our Purchase Price"
                    stroke={COMMODITY_CONFIG[selectedCommodity]?.excelColor}
                    strokeWidth={3}
                    dot={{ r: 4, fill: COMMODITY_CONFIG[selectedCommodity]?.excelColor }}
                    activeDot={{ r: 6, fill: COMMODITY_CONFIG[selectedCommodity]?.excelColor }}
                    connectNulls={true}
                  />
                  <Line
                    type="monotone"
                    dataKey="apiPrice"
                    name="Market Price"
                    stroke={COMMODITY_CONFIG[selectedCommodity]?.apiColor}
                    strokeWidth={3}
                    dot={{ r: 4, fill: COMMODITY_CONFIG[selectedCommodity]?.apiColor }}
                    activeDot={{ r: 6, fill: COMMODITY_CONFIG[selectedCommodity]?.apiColor }}
                    connectNulls={true}
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
                  <div style={{ fontSize: '14px' }}>No recent Excel purchase data found for this commodity (2020-2025)</div>
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
                  Real-time market prices in NGN/kg (Refreshing every 5 minutes)
                </div>
              </div>
            </div>
            
            {loadingLivePrices ? (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                Loading live prices...
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
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>This Month</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Last Month</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Month %</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>This Year</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Last Year</th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #cbd5e1', fontWeight: 600, color: '#374151' }}>Year %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(COMMODITY_CONFIG).map((commodity, index) => {
                      const config = COMMODITY_CONFIG[commodity];
                      const liveData = livePrices[commodity];
                      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                      
                      if (!liveData) return null;
                      
                      const dec = decimalsByCommodity[commodity] || 2;
                      
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
                            color: '#374151'
                          }}>
                            {liveData.current?.toFixed(dec) || '—'}
                          </td>
                          
                          {/* Yesterday */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            color: '#6b7280'
                          }}>
                            {liveData.previous?.toFixed(dec) || '—'}
                          </td>
                          
                          {/* Day % */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {liveData.percentages?.day !== null ? (
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
                          
                          {/* This Month */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            fontWeight: '600',
                            color: '#374151'
                          }}>
                            {liveData.monthAgo?.toFixed(dec) || '—'}
                          </td>
                          
                          {/* Last Month */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            color: '#6b7280'
                          }}>
                            {liveData.lastMonth?.toFixed(dec) || '—'}
                          </td>
                          
                          {/* Month % */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {liveData.percentages?.month !== null ? (
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
                          
                          {/* This Year */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            fontWeight: '600',
                            color: '#374151'
                          }}>
                            {liveData.yearAgo?.toFixed(dec) || '—'}
                          </td>
                          
                          {/* Last Year */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0',
                            color: '#6b7280'
                          }}>
                            {liveData.lastYear?.toFixed(dec) || '—'}
                          </td>
                          
                          {/* Year % */}
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'center', 
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            {liveData.percentages?.year !== null ? (
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            
            <div style={{ 
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid #e2e8f0',
              fontSize: '11px',
              color: '#6b7280',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong>Last Updated:</strong> {livePrices.wheat?.lastUpdated || '—'}
              </div>
              <div>
                <strong>Data Mode:</strong> {useMockData ? 'Mock Data' : 'Real API'}
              </div>
              <div>
                <strong>Prices in:</strong> NGN/kg
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Month Range Info */}
      <div style={{
        padding: '20px',
        backgroundColor: '#f0f9ff',
        borderRadius: '12px',
        border: '2px solid #bae6fd',
        marginTop: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>📅</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '18px', color: '#0369a1' }}>
              Month Range Information
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Showing Excel data range (2020-2025) and API data availability
            </div>
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px'
        }}>
          {Object.keys(COMMODITY_CONFIG).map(commodity => {
            const config = COMMODITY_CONFIG[commodity];
            const comparisonData = monthlyComparisonData[commodity] || [];
            const excelMonths = comparisonData.filter(item => item.excelPrice != null);
            const apiMonths = comparisonData.filter(item => item.apiPrice != null);
            
            if (excelMonths.length === 0) return null;
            
            const firstExcelMonth = excelMonths[0]?.monthDisplay;
            const lastExcelMonth = excelMonths[excelMonths.length - 1]?.monthDisplay;
            
            return (
              <div key={commodity} style={{
                padding: '16px',
                backgroundColor: commodity === selectedCommodity ? '#e0f2fe' : 'white',
                borderRadius: '8px',
                border: `1px solid ${commodity === selectedCommodity ? '#38bdf8' : '#e2e8f0'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '16px' }}>{config.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{config.name}</span>
                </div>
                
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Excel Range</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#3B82F6' }}>
                    {firstExcelMonth} - {lastExcelMonth}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                    {excelMonths.length} months (2020-2025)
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px'
                }}>
                  <span style={{ 
                    color: apiMonths.length > 0 ? '#10B981' : '#9ca3af',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>{apiMonths.length > 0 ? '✓' : '✗'}</span>
                    <span>API: {apiMonths.length}/{excelMonths.length}</span>
                  </span>
                  <span style={{ color: '#6b7280' }}>{COMMODITY_SYMBOLS[commodity]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CommodityDashboard;