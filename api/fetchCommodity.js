// api/fetchCommodity.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { symbol, startdate, enddate } = req.query;
  
  try {
    const apiUrl = `https://ds01.ddfplus.com/historical/queryeod.ashx?username=TolaramMR&password=replay&symbol=${symbol}&data=daily&startdate=${startdate}&enddate=${enddate}`;
    
    const response = await fetch(apiUrl);
    const data = await response.text();
    
    res.status(200).send(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}