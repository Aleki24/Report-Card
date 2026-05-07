interface ModuleWorkflowProps {
  steps: string[];
  title?: string;
}

export default function ModuleWorkflow({ steps, title }: ModuleWorkflowProps) {
  const stepColors = [
    'var(--color-accent)',
    'var(--color-success)',
    'var(--color-warning)',
    'var(--color-danger)',
    'var(--color-purple-500)',
  ];

  return (
    <section style={{ padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: 'clamp(32px, 4vw, 48px)' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border-subtle)' }} />
        <span
          style={{
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.6875rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
          }}
        >
          {title || 'How It Works'}
        </span>
        <div style={{ flex: 1, height: '1px', background: 'var(--color-border-subtle)' }} />
      </div>

      {/* Steps */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 'clamp(16px, 2vw, 20px)',
          maxWidth: '1024px',
          margin: '0 auto',
        }}
      >
        {steps.map((step, idx) => {
          const color = stepColors[idx % stepColors.length];
          const stepNum = String(idx + 1).padStart(2, '0');

          return (
            <div
              key={idx}
              style={{
                position: 'relative',
                padding: 'clamp(20px, 3vw, 28px)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-subtle)',
                transition: 'border-color 0.3s ease',
              }}
            >
              {/* Step Number */}
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2rem, 3.5vw, 2.5rem)',
                  fontWeight: 900,
                  lineHeight: 1,
                  color: 'var(--color-text-primary)',
                  opacity: 0.06,
                  display: 'block',
                  marginBottom: '12px',
                }}
              >
                {stepNum}
              </span>

              {/* Color dot */}
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: color,
                  marginBottom: '12px',
                }}
              />

              {/* Step Text */}
              <p
                style={{
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.7,
                  letterSpacing: '0.01em',
                }}
              >
                {step}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
