import { CheckCircle2 } from 'lucide-react';

interface ModuleFeatureGridProps {
  features: string[];
  title?: string;
}

export default function ModuleFeatureGrid({ features, title }: ModuleFeatureGridProps) {
  return (
    <section style={{ padding: 'clamp(48px, 6vw, 80px) clamp(16px, 5vw, 48px)', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 'clamp(32px, 4vw, 48px)' }}>
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
          Key Features
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
          {title || 'Everything You Need'}
        </h2>
      </div>

      {/* Feature Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'clamp(12px, 2vw, 16px)',
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
        {features.map((feature, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              padding: 'clamp(16px, 2vw, 20px)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
              transition: 'border-color 0.3s ease',
            }}
          >
            <CheckCircle2
              style={{
                width: '20px',
                height: '20px',
                color: 'var(--color-accent)',
                flexShrink: 0,
                marginTop: '1px',
              }}
            />
            <span
              style={{
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                letterSpacing: '0.01em',
              }}
            >
              {feature}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
