// src/components/CommodityNewsSection.jsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'https://ml-mhwe.onrender.com/api'; // ✅ FIXED: Root API base

const COMMODITY_DISPLAY_NAMES = {
  wheat: 'Wheat CBOT',
  milling_wheat: 'Milling Wheat',
  palm: 'Palm Oil',
  sugar: 'Sugar',
  aluminum: 'Aluminum',
  crude_palm: 'Brent Crude Oil',
};

const PLACEHOLDER_IMG = 'https://via.placeholder.com/350x180/CCCCCC/333333?text=NEWS';

const CommodityNewsSection = ({ selectedCommodity }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [commodity, setCommodity] = useState(selectedCommodity || 'wheat');

  // Sync with parent selectedCommodity
  useEffect(() => {
    if (selectedCommodity) {
      setCommodity(selectedCommodity);
      setNews([]);
      setLastUpdated(null);
      setError('');
    }
  }, [selectedCommodity]);

  const fetchNews = useCallback(async (commodityKey, forceRefresh = false) => {
    if (!commodityKey) return;
    setLoading(true);
    setError('');

    try {
      const url = `${API_BASE_URL}/news/${commodityKey}${forceRefresh ? '?refresh=true' : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      setNews(data.news || []);
      setLastUpdated(data.lastUpdated || new Date().toLocaleTimeString());
      setSource(data.source || 'API');
      setCommodity(data.commodity || commodityKey);

      if (data.isFallback) {
        setError('Using fallback news data (scraping temporarily unavailable)');
      }
    } catch (err) {
      console.error('Failed to fetch news:', err);
      setError('Could not load latest news. API may be temporarily unavailable.');
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch when commodity changes
  useEffect(() => {
    if (commodity) {
      fetchNews(commodity);
    }
  }, [commodity, fetchNews]);

  const handleRefreshNews = () => {
    if (commodity && !loading) {
      fetchNews(commodity, true);
    }
  };

  const handleOpenNews = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Global loading state
  if (loading && news.length === 0) {
    return (
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #e2e8f0',
          marginTop: '32px',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>🌀</div>
        <div style={{ fontWeight: '600', color: '#374151' }}>
          Loading market news...
        </div>
        <div style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
          Fetching latest updates for {COMMODITY_DISPLAY_NAMES[commodity] || commodity}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: '32px',
        padding: '24px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px solid #e5e7eb',
      }}
    >
      {/* Header + Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '18px',
              color: '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📰</span>
            <span>Latest Market News – {COMMODITY_DISPLAY_NAMES[commodity] || commodity}</span>
            {source && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  backgroundColor: source === 'Barchart' ? '#DBEAFE' : '#FEF3C7',
                  color: source === 'Barchart' ? '#1E40AF' : '#92400E',
                  borderRadius: '4px',
                  fontWeight: '600',
                }}
              >
                {source}
              </span>
            )}
          </h3>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Real-time updates from Barchart.com •{' '}
            {lastUpdated
              ? `Last updated: ${lastUpdated}`
              : loading
              ? 'Refreshing...'
              : 'Waiting for data...'}
          </div>
        </div>

        {/* Dropdown + Refresh Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              backgroundColor: 'white',
              color: '#374151',
              minWidth: '160px',
            }}
          >
            <option value="wheat">Wheat CBOT</option>
            <option value="milling_wheat">Milling Wheat</option>
            <option value="palm">Palm Oil</option>
            <option value="sugar">Sugar</option>
            <option value="aluminum">Aluminum</option>
            <option value="crude_palm">Brent Crude Oil</option>
          </select>

          <button
            onClick={handleRefreshNews}
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
            {loading ? '⟳ Refreshing...' : '⟳ Latest News'}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#FEF3C7',
            borderRadius: '8px',
            border: '2px solid #F59E0B',
            color: '#92400E',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* News Grid */}
      {news.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px',
            marginTop: '16px',
          }}
        >
          {news.map((item, index) => (
            <NewsCard key={`${item.link || item.title}-${index}`} item={item} onOpen={handleOpenNews} />
          ))}
        </div>
      ) : (
        !loading && (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              border: '1px dashed #e5e7eb',
              marginTop: '16px',
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>📰</div>
            <div style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              No news available
            </div>
            <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
              No recent news found for {COMMODITY_DISPLAY_NAMES[commodity] || commodity}
            </div>
            <button
              onClick={handleRefreshNews}
              style={{
                padding: '8px 20px',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              ⟳ Try Again
            </button>
          </div>
        )
      )}

      {/* Footer */}
      {news.length > 0 && (
        <div
          style={{
            marginTop: '24px',
            padding: '12px',
            backgroundColor: '#F0F9FF',
            borderRadius: '8px',
            border: '1px solid #0EA5E9',
            fontSize: '12px',
            color: '#0369A1',
            textAlign: 'center',
          }}
        >
          News data from Barchart.com • Click cards to read full articles • Cache refreshes every 5 minutes
        </div>
      )}
    </div>
  );
};

const NewsCard = React.memo(({ item, onOpen }) => {
  const [imgError, setImgError] = useState(false);

  const rawUrl = item.imageUrl?.trim();
  const src = (!rawUrl || imgError) ? PLACEHOLDER_IMG : rawUrl;

  return (
    <div
      onClick={() => onOpen(item.link)}
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
          alt={item.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              color: '#3B82F6',
              fontWeight: '600',
              backgroundColor: '#EFF6FF',
              padding: '4px 10px',
              borderRadius: '6px',
            }}
          >
            {item.symbol || 'MARKET'}
          </span>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            {item.scrapedAt?.split(' ')[1] || 'Just now'}
          </span>
        </div>

        <h4
          style={{
            margin: '0 0 10px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
            lineHeight: '1.4',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.title}
        </h4>

        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            color: '#6b7280',
            lineHeight: '1.5',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.description}
        </p>
      </div>
    </div>
  );
});

NewsCard.displayName = 'NewsCard';

export default CommodityNewsSection;
