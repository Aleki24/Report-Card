import Image from 'next/image';
import { Quote, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Section, SectionHeader } from './ui/Section';
import { TESTIMONIALS, type Testimonial } from './testimonials';

export default function TestimonialsSection() {
  // Hidden until real testimonials exist — see ./testimonials.ts.
  const [featured, ...rest] = TESTIMONIALS;
  if (!featured) return null;

  return (
    <Section id="testimonials">
      <SectionHeader
        eyebrow="From the staffroom"
        title="Heard from schools"
        highlight="already on Skulbase."
      />

      <div className="flex flex-col gap-4 md:gap-6">
        <TestimonialCard testimonial={featured} featured />

        {rest.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {rest.map((testimonial) => (
              <li key={`${testimonial.name}-${testimonial.school}`}>
                <TestimonialCard testimonial={testimonial} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function TestimonialCard({ testimonial, featured = false }: { testimonial: Testimonial; featured?: boolean }) {
  const { quote, result } = testimonial;

  return (
    <figure
      className={cn(
        'relative flex h-full flex-col gap-6 overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8',
        featured && 'bg-gradient-to-br from-primary/10 via-card to-card md:gap-8 md:p-12',
      )}
    >
      <Quote
        aria-hidden
        className={cn('text-primary/20', featured ? 'absolute top-6 right-6 size-16 md:size-24' : 'size-8')}
      />

      {result && (
        <p className="inline-flex w-fit items-center gap-2 rounded-full bg-positive/10 px-3 py-1 text-xs font-semibold text-positive">
          <TrendingUp className="size-3.5" aria-hidden />
          {result}
        </p>
      )}

      <blockquote
        className={cn(
          'flex-1 leading-relaxed text-foreground',
          featured ? 'max-w-3xl font-heading text-xl font-semibold tracking-tight md:text-3xl md:leading-snug' : 'text-base',
        )}
      >
        <p>&ldquo;{quote}&rdquo;</p>
      </blockquote>

      <Attribution testimonial={testimonial} />
    </figure>
  );
}

function Attribution({ testimonial }: { testimonial: Testimonial }) {
  const { name, role, school, location, curriculum, photo } = testimonial;
  const details = [school, location].filter(Boolean).join(' · ');

  return (
    <figcaption className="flex items-center gap-3">
      <Avatar name={name} photo={photo} />
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">
          {role}, {details}
        </p>
      </div>
      {curriculum && (
        <span className="ml-auto hidden shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline">
          {curriculum}
        </span>
      )}
    </figcaption>
  );
}

function Avatar({ name, photo }: Pick<Testimonial, 'name' | 'photo'>) {
  if (photo) {
    return <Image src={photo} alt="" width={44} height={44} className="size-11 shrink-0 rounded-full object-cover" />;
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {initials}
    </span>
  );
}
