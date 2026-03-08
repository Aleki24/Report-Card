import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function StudentsPage() {
    const supabase = await createSupabaseServerClient();

    const { data: students } = await supabase
        .from('students')
        .select('id, full_name, enrollment_number, classrooms(name)')
        .order('full_name', { ascending: true });

    return (
        <div className="w-full max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-display)] mb-2">Students</h1>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        Manage student records and view individual performance
                    </p>
                </div>
                <button className="btn-primary shrink-0">+ Add Student</button>
            </div>

            {/* Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <input
                    className="input-field sm:max-w-md w-full"
                    placeholder="Search by name or enrollment number..."
                />
            </div>

            <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="data-table whitespace-nowrap w-full">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Enrollment #</th>
                                <th>Class</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(students && students.length > 0) ? students.map((s: any, i: number) => (
                                <tr key={s.id || i}>
                                    <td className="font-medium text-[var(--color-text-primary)]">{s.full_name}</td>
                                    <td className="text-[var(--color-text-muted)] font-mono text-sm">{s.enrollment_number}</td>
                                    <td>{(s.classrooms as any)?.name || '—'}</td>
                                    <td>
                                        <a
                                            href={`/api/reports/student/${s.id}`}
                                            className="btn-secondary px-3 py-1 text-xs inline-flex"
                                            target="_blank"
                                        >
                                            ↓ Report
                                        </a>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="text-center text-[var(--color-text-muted)] py-8">
                                        No students found. Add students via the Supabase dashboard or mark entry.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
