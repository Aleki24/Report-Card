export default function DashboardPage() {
    return (
        <div>
            {/* Page Header */}
            <div style={{ marginBottom: 'var(--space-8)' }}>
                <h1 style={{ fontSize: 28, marginBottom: 'var(--space-2)' }}>Dashboard</h1>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
                    Overview of student performance and key metrics
                </p>
            </div>

            {/* KPI Cards */}
            <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}
            >
                <div className="stat-card">
                    <div className="stat-label">Total Students</div>
                    <div className="stat-value">247</div>
                    <div style={{ fontSize: 12, color: 'var(--color-success)' }}>↑ 12 new this term</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Class Average</div>
                    <div className="stat-value">72.4%</div>
                    <div style={{ fontSize: 12, color: 'var(--color-success)' }}>↑ 3.2% from last term</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Pass Rate</div>
                    <div className="stat-value">88.6%</div>
                    <div style={{ fontSize: 12, color: 'var(--color-warning)' }}>↓ 1.1% from last term</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Reports Generated</div>
                    <div className="stat-value">1,024</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>This academic year</div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div
                className="grid grid-cols-1 lg:grid-cols-2"
                style={{ gap: 'var(--space-6)' }}
            >
                {/* Top Performers */}
                <div className="card">
                    <h3 style={{ fontSize: 16, marginBottom: 'var(--space-4)' }}>🏆 Top Performers</h3>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr><th>Student</th><th>Class</th><th>Avg %</th></tr>
                            </thead>
                            <tbody>
                                {[
                                    { name: 'Alice Moraa', cls: 'Grade 10A', avg: '96.2%' },
                                    { name: 'Brian Ochieng', cls: 'Grade 10A', avg: '94.8%' },
                                    { name: 'Catherine Wanjiku', cls: 'Grade 10B', avg: '93.1%' },
                                    { name: 'David Kamau', cls: 'Grade 9A', avg: '91.7%' },
                                    { name: 'Emily Akinyi', cls: 'Grade 9B', avg: '90.3%' },
                                ].map((s, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                                        <td style={{ color: 'var(--color-text-muted)' }}>{s.cls}</td>
                                        <td><span className="badge badge-success">{s.avg}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Needs Attention */}
                <div className="card">
                    <h3 style={{ fontSize: 16, marginBottom: 'var(--space-4)' }}>⚠️ Needs Attention</h3>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr><th>Student</th><th>Subject</th><th>Score</th></tr>
                            </thead>
                            <tbody>
                                {[
                                    { name: 'Felix Mwangi', subj: 'Mathematics', score: '32%' },
                                    { name: 'Grace Otieno', subj: 'Physics', score: '38%' },
                                    { name: 'Hassan Ali', subj: 'Chemistry', score: '41%' },
                                    { name: 'Irene Njeri', subj: 'English', score: '44%' },
                                    { name: 'James Kiprop', subj: 'Biology', score: '45%' },
                                ].map((s, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 500 }}>{s.name}</td>
                                        <td style={{ color: 'var(--color-text-muted)' }}>{s.subj}</td>
                                        <td><span className="badge badge-danger">{s.score}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
