// src/components/CommodityNewsSection.jsx
import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'https://ml-mhwe.onrender.com/api/forecast';

const COMMODITY_DISPLAY_NAMES = {
  wheat: 'Wheat CBOT',
  milling_wheat: 'Milling Wheat',
  palm: 'Palm Oil',
  sugar: 'Sugar',
  aluminum: 'Aluminum',
  crude_palm: 'Brent Crude Oil',
};

const PLACEHOLDER_IMG =
  'https://via.placeholder.com/350x180/CCCCCC/333333?text=NEWS';

const CommodityNewsSection = ({ selectedCommodity }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [commodity, setCommodity] = useState(selectedCommodity || 'wheat');

  // keep local commodity in sync with parent
  useEffect(() => {
    if (selectedCommodity) {
      setCommodity(selectedCommodity);
      setNews([]);
      setLastUpdated(null);
      setError('');
    }
  }, [selectedCommodity]);

  const fetchNews = useCallback(
    async (commodityKey, forceRefresh = false) => {
      if (!commodityKey) return;
      setLoading(true);
      setError('');

      try {
        const url = `${API_BASE_URL}/news/${commodityKey}${
          forceRefresh ? '?refresh=true' : ''
        }`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();

        setNews(data.news || []);
        setLastUpdated(
          data.lastUpdated || new Date().toLocaleTimeString()
        );
        setSource(data.source || 'API');

        if (data.isFallback) {
          setError('Using fallback news data (scraping failed)');
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
        setError('Could not load latest news. Check API connection.');
        setNews([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // when commodity changes via dropdown, clear and refetch
  useEffect(() => {
    if (commodity) {
      setNews([]);
      setLastUpdated(null);
      setError('');
      fetchNews(commodity);
    }
  }, [commodity, fetchNews]);

  const handleRefreshNews = () => {
    if (commodity && !loading) {
      setNews([]);
      fetchNews(commodity, true);
    }
  };

  const handleOpenNews = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // GLOBAL loading state (no news yet for this commodity)
  if (loading && news.length === 0) {
    return (
      <div
        key={commodity}
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
        <div
          style={{
            color: '#6b7280',
            fontSize: '14px',
            marginTop: '8px',
          }}
        >
          Fetching latest updates for{' '}
          {COMMODITY_DISPLAY_NAMES[commodity] || commodity}
        </div>
      </div>
    );
  }

  return (
    <div
      key={commodity} // force remount on commodity change
      style={{
        marginTop: '32px',
        padding: '24px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '2px solid '
      }}
    >
      {/* Header + dropdown */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '16px',
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
            <span>
              Latest Market News –{' '}
              {COMMODITY_DISPLAY_NAMES[commodity] || commodity}
            </span>
            {source && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  backgroundColor:
                    source === 'Barchart' ? '#DBEAFE' : '#FEF3C7',
                  color: source === 'Barchart' ? '#1E40AF' : '#92400E',
                  borderRadius: '4px',
                  fontWeight: '600',
                }}
              >
                {source}
              </span>
            )}
          </h3>
          <div
            style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '4px',
            }}
          >
            Real-time updates from Barchart.com •{' '}
            {lastUpdated
              ? `Last updated: ${lastUpdated}`
              : loading
              ? 'Refreshing...'
              : 'Waiting for data...'}
          </div>
        </div>

        {/* Dropdown + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={commodity}
            onChange={(e) => {
              setCommodity(e.target.value);
            }}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              backgroundColor: 'white',
              color: '#374151',
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
            {loading ? 'Refreshing...' : 'Get Latest News'}
          </button>
        </div>
      </div>

      {/* Error */}
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

      {/* News grid */}
      {news.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '20px',
            marginTop: '16px',
          }}
        >
          {news.map((item) => (
            <NewsCard
              key={item.link || item.title}
              item={item}
              onOpen={handleOpenNews}
            />
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
            }}
          >
            <div style={{ fontSize: '20px', marginBottom: '12px' }}>📰</div>
            <div
              style={{
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
              }}
            >
              No news available
            </div>
            <div
              style={{
                color: '#6b7280',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            >
              No recent news found for {COMMODITY_DISPLAY_NAMES[commodity]}
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
              ↻ Retry
            </button>
          </div>
        )
      )}

      {/* Footer */}
      {news.length > 0 && (
        <div
          style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: '#F0F9FF',
            borderRadius: '8px',
            border: '1px solid #0EA5E9',
            fontSize: '12px',
            color: '#0369A1',
            textAlign: 'center',
          }}
        >
          News data scraped from Barchart.com • Click any card to read the full
          article • Updates every 5 minutes
        </div>
      )}
    </div>
  );
};

const NewsCard = React.memo(function NewsCard({ item, onOpen }) {
  const [imgError, setImgError] = useState(false);

  const rawUrl = item.imageUrl?.trim();
  const src = !rawUrl || imgError ? PLACEHOLDER_IMG : rawUrl; // treat empty/whitespace as no image[web:89]

  return (
    <div
      onClick={() => onOpen(item.link)}
      style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Image with placeholder fallback */}
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
              borderRadius: '4px',
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
            color: '#374151',
            lineHeight: '1.4',
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

export default CommodityNewsSection;
