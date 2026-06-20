import { useState, useEffect } from 'react';
import { q, authHeaders } from '../api/client';

const API = '/api/asset-management';

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function BarChart({ data, color, labelKey, valueKey, height = 160 }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <svg viewBox={`0 0 ${data.length * 60} ${height}`} style={{ width: '100%', height }}>
      {data.map((d, i) => {
        const barH = (d[valueKey] / max) * (height - 30);
        const x = i * 60 + 8;
        const w = 44;
        return (
          <g key={i}>
            <rect x={x} y={height - 20 - barH} width={w} height={barH} rx={3}
              fill={color} opacity={0.85} />
            <text x={x + w / 2} y={height - 20 - barH - 4} textAnchor="middle"
              fill="#333" fontSize={11} fontWeight={600}>
              {d[valueKey]}
            </text>
            <text x={x + w / 2} y={height - 4} textAnchor="middle"
              fill="#888" fontSize={9}>
              {d[labelKey]?.length > 10 ? d[labelKey].slice(0, 10) + '…' : d[labelKey]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [assetKpis, setAssetKpis] = useState(null);
  const [kpiError, setKpiError] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      q('customers', { select: 'id' }),
      q('contractors', { select: 'id' }),
      q('customerLocations', { select: 'id' }),
      q('requests', { select: 'id' }),
      q('leads', { select: 'id' }),
    ]).then(([cust, cont, loc, req, leads]) => {
      setStats({
        customers: cust?.length || 0,
        contractors: cont?.length || 0,
        locations: loc?.length || 0,
        requests: req?.length || 0,
        leads: leads?.length || 0,
      });
    });
  }, []);

  useEffect(() => {
    fetch(`${API}/reports/dashboard`, { headers: { ...authHeaders() } })
      .then(r => r.ok ? r.json() : Promise.reject('Failed to load KPIs'))
      .then(data => { setAssetKpis(data); setKpiLoading(false); })
      .catch(err => { setKpiError(err?.message || 'Failed to load KPIs'); setKpiLoading(false); });
  }, []);

  if (!stats) return <div className="pulse" style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  const tiles = [
    { label: 'Customers', value: stats.customers, href: '/customers', color: '#00d4ff' },
    { label: 'Contractors', value: stats.contractors, href: '/contractors', color: '#00ff88' },
    { label: 'Locations', value: stats.locations, color: '#ff9500' },
    { label: 'Requests', value: stats.requests, href: '/requests', color: '#ff4757' },
    { label: 'Leads', value: stats.leads, href: '/leads', color: '#3b82f6' },
  ];

  const assetTiles = [
    { label: 'Total Assets', value: assetKpis?.total_assets ?? '—', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
    { label: 'Active Assets', value: assetKpis?.active_assets ?? '—', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    { label: 'Active Work Orders', value: assetKpis?.active_work_orders ?? '—', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    { label: 'Overdue Maintenance', value: assetKpis?.overdue_maintenance ?? '—', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    { label: 'Warranty Expiring', value: assetKpis?.warranty_expiring_soon ?? '—', color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
    { label: 'Total Costs', value: fmt(assetKpis?.total_costs), color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 20, fontSize: 20 }}>Dashboard</h2>

      {/* Row 1: Existing tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {tiles.map(t => (
          <a key={t.label} href={t.href || '#'}
             style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e0e0e0', textDecoration: 'none', display: 'block' }}>
            <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>{t.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.color }}>{t.value}</div>
          </a>
        ))}
      </div>

      {/* Row 2: Asset KPI cards */}
      <h3 style={{ fontSize: 16, marginBottom: 12, color: '#1a1a2e' }}>Asset Overview</h3>
      {kpiLoading ? (
        <div className="pulse" style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading asset data...</div>
      ) : kpiError ? (
        <div style={{ padding: 16, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {kpiError}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            {assetTiles.map(t => (
              <div key={t.label}
                 style={{ background: t.bg, borderRadius: 8, padding: 20, border: `1px solid ${t.border}`, display: 'block' }}>
                <div style={{ color: t.color, fontSize: 11, textTransform: 'uppercase', marginBottom: 6, opacity: 0.8 }}>{t.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: t.color }}>{t.value}</div>
              </div>
            ))}
          </div>

          {/* Row 3: Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: 20 }}>
              <h4 style={{ fontSize: 14, marginBottom: 12, color: '#444' }}>Assets by Status</h4>
              {assetKpis?.assets_by_status?.length > 0 ? (
                <BarChart data={assetKpis.assets_by_status} color="#3b82f6" labelKey="status" valueKey="count" />
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>No data</div>
              )}
            </div>
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', padding: 20 }}>
              <h4 style={{ fontSize: 14, marginBottom: 12, color: '#444' }}>Assets by Category</h4>
              {assetKpis?.assets_by_category?.length > 0 ? (
                <BarChart data={assetKpis.assets_by_category} color="#8b5cf6" labelKey="category" valueKey="count" />
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>No data</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
