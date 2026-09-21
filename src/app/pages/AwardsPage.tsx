import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { CollectionBookCard } from '@/app/components/CollectionBookCard';
import { AwardSeal } from '@/app/components/AwardBadge';
import { useDocumentTitle } from '@/app/hooks/useDocumentTitle';
import { badgeLabel, getAwards, sealUrl, type Award, type AwardEntry, type AwardsData } from '@/lib/collections';

// How the index groups the prizes.
const GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Literary', ids: ['pulitzer-fiction', 'nba-fiction', 'booker', 'nba-translated', 'pulitzer-nonfiction', 'nba-nonfiction'] },
  { title: 'Science Fiction, Fantasy & Mystery', ids: ['hugo-novel', 'edgar-novel'] },
  { title: 'Graphic Novels', ids: ['eisner-graphic-album', 'eisner-graphic-memoir'] },
  { title: "Children's & Young Adult", ids: ['newbery', 'caldecott', 'printz', 'nba-young-people'] },
];

const badgeFor = (award: Award, e: AwardEntry) => ({
  award, year: e.year, result: e.result, label: badgeLabel(award, e.result),
  seal: sealUrl(e.result === 'winner' ? award.seal.winner : award.seal.finalist),
});

const Source = ({ data, award }: { data: AwardsData; award?: Award }) => (
  <p className="text-xs text-muted-foreground border-t border-border pt-6 mt-4">
    {data.verifiedNote}{' '}
    {award && (
      <a href={award.source} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary inline-flex items-center gap-1">
        Official {award.name} site <ExternalLink size={11} />
      </a>
    )}{' '}
    Books we carry open in our store; the rest link to Bookshop.org, which supports us too.
  </p>
);

/** /collections/awards - every award, with its latest winner. */
const AwardsIndex = ({ data }: { data: AwardsData }) => {
  useDocumentTitle('Award Winners');
  const byId = new Map(data.awards.map(a => [a.id, a]));
  const latestWinner = (id: string) =>
    data.results.filter(r => r.award === id && r.result === 'winner').sort((a, b) => b.year - a.year)[0];

  return (
    <>
      <header className="max-w-3xl mb-12">
        <h1 className="text-4xl sm:text-5xl font-serif font-bold text-primary mb-3">Award Winners</h1>
        <p className="text-muted-foreground">
          A decade of winners and finalists from the most respected prizes in books — from the Pulitzer and the
          Booker to the Hugo, the Eisner and the Newbery.
        </p>
      </header>

      {GROUPS.map(group => (
        <section key={group.title} className="mb-14">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-5">{group.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {group.ids.map(id => {
              const award = byId.get(id);
              const top = latestWinner(id);
              if (!award || !top) return null;
              return (
                <Link key={id} to={`/collections/awards/${id}`}
                      className="group flex gap-4 items-start rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all">
                  <AwardSeal badge={badgeFor(award, top)} />
                  <div className="min-w-0">
                    <p className="font-serif font-bold text-primary group-hover:underline">{award.name}</p>
                    <p className="text-xs text-muted-foreground mb-2">{award.category}</p>
                    <p className="text-xs text-foreground">
                      <span className="text-muted-foreground">{top.year} winner:</span> <span className="italic">{top.book.title}</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mb-14">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-5">Nobel Prize in Literature</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
          The Nobel honours an author's whole body of work rather than a single book, so its laureates don't have
          finalists — every book they've written carries the prize.
        </p>
        <div className="flex flex-wrap gap-2">
          {[...data.nobel].sort((a, b) => b.year - a.year).map(n => (
            <Link key={n.author} to={`/shop?search=${encodeURIComponent(n.author)}`}
                  className="px-3 py-1.5 rounded-full border border-border text-sm hover:border-primary hover:text-primary transition-colors">
              <span className="text-muted-foreground">{n.year}</span> {n.author}
            </Link>
          ))}
        </div>
      </section>

      <Source data={data} />
    </>
  );
};

/** /collections/awards/:awardId - every year, newest first. */
const AwardDetail = ({ data, award }: { data: AwardsData; award: Award }) => {
  useDocumentTitle(`${award.name}: ${award.category}`);
  const years = useMemo(() => {
    const map = new Map<number, AwardEntry[]>();
    for (const r of data.results.filter(r => r.award === award.id)) map.set(r.year, [...(map.get(r.year) ?? []), r]);
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [data, award]);

  return (
    <>
      <Link to="/collections/awards" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8">
        <ArrowLeft size={16} /> All awards
      </Link>
      <header className="max-w-3xl mb-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">{award.category}</p>
        <h1 className="text-4xl sm:text-5xl font-serif font-bold text-primary">{award.name}</h1>
      </header>

      {years.map(([year, entries]) => {
        const sorted = [...entries].sort((a, b) => (a.result === b.result ? 0 : a.result === 'winner' ? -1 : 1));
        return (
          <section key={year} className="mb-14">
            <h2 className="text-2xl font-serif font-bold text-primary border-b border-border pb-3 mb-6">{year}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-8">
              {sorted.map((e, i) => (
                <CollectionBookCard
                  key={`${e.book.title}-${i}`}
                  book={e.book}
                  eyebrow={
                    <span className={e.result === 'winner' ? 'text-[#9C7E22]' : 'text-muted-foreground'}>
                      {e.result === 'winner' ? 'Winner' : award.finalistLabel}
                    </span>
                  }
                  footer={<></>}
                />
              ))}
            </div>
          </section>
        );
      })}

      <Source data={data} award={award} />
    </>
  );
};

export const AwardsPage = () => {
  const { awardId } = useParams();
  const [data, setData] = useState<AwardsData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { getAwards().then(setData).catch(() => setFailed(true)); }, []);

  const award = awardId ? data?.awards.find(a => a.id === awardId) : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      {failed && <p className="text-center text-muted-foreground py-24">The award lists didn't load. Please try again in a moment.</p>}
      {!data && !failed && <div className="py-32" aria-busy="true" />}
      {data && !awardId && (
        <>
          <Link to="/collections" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8">
            <ArrowLeft size={16} /> All collections
          </Link>
          <AwardsIndex data={data} />
        </>
      )}
      {data && awardId && award && <AwardDetail data={data} award={award} />}
      {data && awardId && !award && (
        <div className="text-center py-24">
          <p className="text-muted-foreground mb-4">We don't track that award.</p>
          <Link to="/collections/awards" className="text-primary inline-flex items-center gap-1 hover:underline">
            See all awards <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
};
