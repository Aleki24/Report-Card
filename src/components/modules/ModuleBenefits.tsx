import { CheckCircle2 } from 'lucide-react';

interface ModuleBenefitsProps {
  benefits: string[];
  title?: string;
}

export default function ModuleBenefits({ benefits, title }: ModuleBenefitsProps) {
  return (
    <section
      style={{
        padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)',
        maxWidth: '880px',
        margin: '0 auto',
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 'clamp(24px, 3vw, 40px)' }}>
        <span
          style={{
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            display: 'block',
            marginBottom: '16px',
          }}
        >
          Why It Matters
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)',
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
          }}
        >
          {title || 'Benefits for Your School'}
        </h2>
      </div>

      {/* Benefits List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '640px',
          margin: '0 auto',
        }}
      >
        {benefits.map((benefit, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px',
              padding: '20px 24px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <CheckCircle2
              style={{
                width: '22px',
                height: '22px',
                color: 'var(--color-success)',
                flexShrink: 0,
                marginTop: '1px',
              }}
            />
            <span
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.9375rem',
                lineHeight: 1.6,
                letterSpacing: '0.01em',
              }}
            >
              {benefit}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
