import { useState, useEffect } from 'react';
import { q } from '../api/client';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

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

  if (!stats) return <div className="pulse" style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  const tiles = [
    { label: 'Customers', value: stats.customers, href: '/customers', color: '#00d4ff' },
    { label: 'Contractors', value: stats.contractors, href: '/contractors', color: '#00ff88' },
    { label: 'Locations', value: stats.locations, color: '#ff9500' },
    { label: 'Requests', value: stats.requests, href: '/requests', color: '#ff4757' },
    { label: 'Leads', value: stats.leads, href: '/leads', color: '#3b82f6' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 20, fontSize: 20 }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        {tiles.map(t => (
          <a key={t.label} href={t.href || '#'}
             style={{ background: '#fff', borderRadius: 8, padding: 20, border: '1px solid #e0e0e0', textDecoration: 'none', display: 'block' }}>
            <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', marginBottom: 6 }}>{t.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.color }}>{t.value}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
