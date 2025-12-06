const fs = require('fs');
const fetch = require('node-fetch');

async function downloadBarchartData() {
  const commodities = [
    { symbol: 'ZWZ25', name: 'wheat' },
    { symbol: 'KOU25', name: 'palm-oil' }
  ];

  for (const { symbol, name } of commodities) {
    try {
      console.log(`📥 Downloading ${name} (${symbol})...`);
      
      const url = `https://historical-quotes.aws.barchart.com/historical/queryminutes.ashx?username=TolaramMR&password=replay&symbol=${symbol}&start=20250101&end=20251130`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      // Save raw data
      fs.writeFileSync(`barchart-${name}.json`, JSON.stringify(data, null, 2));
      
      console.log(`✅ Saved barchart-${name}.json (${data.results?.length || 0} records)`);
    } catch (error) {
      console.error(`❌ ${name} failed:`, error.message);
    }
  }
}

downloadBarchartData();
