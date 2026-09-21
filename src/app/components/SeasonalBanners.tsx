import React from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { activeFeatures, type ActiveFeature } from '@/lib/seasons';

const Banner = ({ f, large }: { f: ActiveFeature; large: boolean }) => (
  <Link
    to={f.to}
    className={`group block rounded-2xl p-6 transition-colors ${
      f.status === 'now' ? 'bg-primary text-white hover:bg-primary/95' : 'bg-card border border-border hover:border-primary/40'
    } ${large ? 'sm:p-8' : ''}`}
  >
    <p className={`text-xs font-bold uppercase tracking-[0.2em] mb-2 ${f.status === 'now' ? 'text-white/60' : 'text-accent'}`}>
      {f.status === 'now' ? 'Now' : 'Coming up'} · {f.range}
    </p>
    <h2 className={`font-serif font-bold mb-2 ${large ? 'text-2xl sm:text-3xl' : 'text-xl'} ${f.status === 'now' ? '' : 'text-primary'}`}>
      {f.title}
      {f.theme && <>: “{f.theme}”</>}
    </h2>
    <p className={`mb-4 max-w-2xl ${f.status === 'now' ? 'text-white/80' : 'text-muted-foreground'}`}>{f.blurb}</p>
    <span className={`inline-flex items-center text-sm font-bold group-hover:underline ${f.status === 'now' ? '' : 'text-primary'}`}>
      {f.cta} <ArrowRight size={16} className="ml-1" />
    </span>
  </Link>
);

/**
 * Whatever the calendar says to feature: one wide banner, or a row of cards.
 * Renders nothing between seasons. `only` limits it to a single feature, for
 * showing a collection's own banner on its page.
 */
export const SeasonalBanners = ({
  only,
  status,
  className = '',
}: {
  only?: string;
  /** Just the running features, or just the ones coming up. */
  status?: 'now' | 'upcoming';
  className?: string;
}) => {
  const features = activeFeatures().filter(f => (!only || f.id === only) && (!status || f.status === status));
  if (features.length === 0) return null;
  return (
    <div className={`grid gap-4 ${features.length > 1 ? 'md:grid-cols-2' : ''} ${features.length > 2 ? 'lg:grid-cols-3' : ''} ${className}`}>
      {features.map(f => <Banner key={f.id} f={f} large={features.length === 1} />)}
    </div>
  );
};
