export default function StudentLoading() {
    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <div className="skeleton-bone" style={{ width: '50%', height: 22, borderRadius: 6, marginBottom: 8 }} />
                <div className="skeleton-bone" style={{ width: '35%', height: 14, borderRadius: 6 }} />
            </div>
            <div className="student-kpi-grid">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="student-skeleton-card" style={{ height: 88 }}>
                        <div className="skeleton-bone" style={{ width: '45%', height: 12, borderRadius: 6, marginBottom: 8 }} />
                        <div className="skeleton-bone" style={{ width: '30%', height: 24, borderRadius: 6 }} />
                    </div>
                ))}
            </div>
            <div className="student-skeleton-card" style={{ height: 260 }}>
                <div className="skeleton-bone" style={{ width: '40%', height: 16, borderRadius: 6, marginBottom: 16 }} />
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton-bone" style={{ width: '100%', height: 36, borderRadius: 8, marginBottom: 8 }} />
                ))}
            </div>
        </div>
    );
}
