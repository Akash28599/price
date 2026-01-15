// src/components/CommodityNewsSection.jsx - BARCHART INTEGRATION
import React, { useState, useEffect, useCallback } from 'react';

const BARCHART_API_KEY = 'c79bd18ab4559ad7d12d851262807a8f';

// Configuration for commodities
const COMMODITY_CONFIG = {
  wheat: {
    name: 'Wheat',
    supported: true,
    // Using a general query for Wheat since the user provided aluminum link twice, inferring standard Wheat query
    // Actually, looking at the user request carefully, they gave ALH26 for aluminum twice.
    // For wheat, I will use a standard wheat keyword search.
    apiUrl: `https://ondemand.websol.barchart.com/getNews.json?apikey=${BARCHART_API_KEY}&sources=BCNEWS&category=Commodities&keyword=wheat&maxRecords=6&displayType=headline&images=true&fields=id,headline,pubDate,source,images,preview,canonicalUrl`
  },
  sugar: {
    name: 'Sugar',
    supported: true,
    apiUrl: `https://ondemand.websol.barchart.com/getNews.json?apikey=${BARCHART_API_KEY}&sources=BCNEWS&symbols=SBH26&category=Commodities&keyword=sugar&maxRecords=6&startDate=2026-01-01T00:00:00&displayType=headline&images=true&fields=id,headline,pubDate,source,images,preview,canonicalUrl`
  },
  aluminum: {
    name: 'Aluminum',
    supported: true,
    apiUrl: `https://ondemand.websol.barchart.com/getNews.json?apikey=${BARCHART_API_KEY}&sources=BCNEWS&symbols=ALH26&category=Commodities&keyword=aluminum&maxRecords=6&startDate=2026-01-01T00:00:00&displayType=headline&images=true&fields=id,headline,pubDate,source,images,preview,canonicalUrl`
  },
  milling_wheat: { name: 'Milling Wheat', supported: false },
  palm: { name: 'Palm Oil', supported: false },
  crude_palm: { name: 'Brent Crude Oil', supported: false }
};

const PLACEHOLDER_IMG = 'https://via.placeholder.com/350x180/CCCCCC/333333?text=NEWS';

const CommodityNewsSection = ({ selectedCommodity = 'wheat' }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Normalize commodity key to ensure it matches our config
  const commodityKey = COMMODITY_CONFIG[selectedCommodity] ? selectedCommodity : 'wheat';
  const config = COMMODITY_CONFIG[commodityKey];

  const fetchNews = useCallback(async () => {
    if (!config.supported) {
      setNews([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(config.apiUrl);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      
      if (data.status?.code === 200 && Array.isArray(data.results)) {
        setNews(data.results);
      } else {
        setNews([]);
        if (data.status?.message) {
             console.warn('Barchart API Message:', data.status.message);
        }
      }
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setError('Could not load latest news.');
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleOpenNews = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Header Component
  const Header = () => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      gap: '16px',
      flexWrap: 'wrap',
    }}>
      <div>
        <h3 style={{
          margin: 0,
          fontSize: '18px',
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>📰</span>
          <span>Latest Market News – {config.name}</span>
        </h3>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
             Powered by Barchart
        </div>
      </div>
      
      {config.supported && (
        <button
            onClick={fetchNews}
            disabled={loading}
            style={{
            padding: '8px 16px',
            backgroundColor: loading ? '#9ca3af' : '#3B82F6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: loading ? 0.7 : 1,
            }}
        >
            {loading ? 'Refreshing...' : '⟳ Refresh'}
        </button>
      )}
    </div>
  );

  // Loading State
  if (loading) {
    return (
      <div style={{
        marginTop: '32px',
        padding: '24px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px dashed #e2e8f0',
        textAlign: 'center'
      }}>
        <Header />
        <div style={{ padding: '40px' }}>
             <div style={{ fontSize: '24px', marginBottom: '12px' }}>🌀</div>
             <div>Loading latest news...</div>
        </div>
      </div>
    );
  }

  // Unsupported Commodity State
  if (!config.supported) {
    return (
      <div style={{
        marginTop: '32px',
        padding: '24px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px solid #e5e7eb',
      }}>
        <Header />
        <div style={{
          padding: '60px',
          textAlign: 'center',
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px dashed #e5e7eb'
        }}>
          <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.5 }}>🚧</div>
          <h3 style={{ color: '#374151', marginBottom: '8px' }}>Coming Soon</h3>
          <p style={{ color: '#6b7280', maxWidth: '400px', margin: '0 auto' }}>
            We are working on integrating live news updates for {config.name}. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '32px',
      padding: '24px',
      backgroundColor: '#f8fafc',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
    }}>
      <Header />

      {error && (
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          backgroundColor: '#FEF3C7',
          borderRadius: '8px',
          border: '1px solid #F59E0B',
          color: '#92400E',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {news.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
          marginTop: '16px',
        }}>
          {news.map((item, index) => (
            <NewsCard key={`${item.id || index}`} item={item} onOpen={handleOpenNews} />
          ))}
        </div>
      ) : (
        !loading && !error && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                No recent news found.
            </div>
        )
      )}
    </div>
  );
};

const NewsCard = React.memo(({ item, onOpen }) => {
  // Use Barchart API fields
  // Note: some responses might not have 'images' populated, so we check or fallback
  // The API request includes 'images=true', structure: item.images might be null or array?
  // Usually Barchart API returns 'images' as null or an array of objects.
  
  // Actually, checking standard Barchart response, image might be embedded or not. 
  // Let's assume preview or standard generic image if missing.
  
  const [imgError, setImgError] = useState(false);

  // Extract relevant fields
  const title = item.headline;
  const description = item.preview || item.summary || ''; // 'preview' is in the requested fields
  const dateStr = item.pubDate || item.timestamp;
  const sourceName = item.source || 'Barchart';
  const url = item.canonicalUrl || item.url;
  
  // Try to find an image URL if available in the response structure
  // The response example has `headlineURL`: null, `pdfURL`: null
  // It doesn't explicitly show an image url field in the root object in the example provided by user
  // except `images=true` was requested.
  // If no image is returned, we use placeholder.
  // Check for image URL in response
  const rawUrl = item.imageURL?.trim();
  // Use placeholder if no URL or error
  const src = (!rawUrl || imgError) ? PLACEHOLDER_IMG : rawUrl;

  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
  }) : '';

  return (
    <div
      onClick={() => onOpen(url)}
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      }}
    >
      {/* Image */}
      <div
        style={{
          height: '180px',
          backgroundColor: '#f3f4f6',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={src}
          alt={title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '10px',
            fontSize: '11px',
            color: '#6b7280'
        }}>
            <span style={{ fontWeight: '600', color: '#3B82F6' }}>{sourceName}</span>
            <span>{formattedDate}</span>
        </div>
        
        <h4 style={{
          margin: '0 0 10px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1f2937',
          lineHeight: '1.4',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {title}
        </h4>

        <p style={{
          margin: '0',
          fontSize: '14px',
          color: '#6b7280',
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1
        }}>
          {description}
        </p>
      </div>
      
      <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #f3f4f6',
          fontSize: '13px',
          color: '#3B82F6',
          fontWeight: '500'
      }}>
          Read more →
      </div>
    </div>
  );
});

NewsCard.displayName = 'NewsCard';

export default CommodityNewsSection;
