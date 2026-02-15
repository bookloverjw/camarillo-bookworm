import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router';

interface SeriesRecommendation {
  title: string;
  author: string;
  why: string;
}

interface ReadAlikeSeries {
  id: string;
  title: string;
  author: string;
  description: string;
  recommendations: SeriesRecommendation[];
}

interface ReadingLevel {
  label: string;
  ages: string;
  description: string;
  series: ReadAlikeSeries[];
}

const READING_LEVELS: ReadingLevel[] = [
  {
    label: 'Picture Books & Early Readers',
    ages: 'Ages 3-7',
    description: 'First favorites that spark a love of reading',
    series: [
      {
        id: 'elephant-piggie',
        title: 'Elephant & Piggie',
        author: 'Mo Willems',
        description: 'Gerald and Piggie teach kids about friendship through laugh-out-loud dialogue.',
        recommendations: [
          { title: 'Frog and Toad', author: 'Arnold Lobel', why: 'Same warmhearted best-friend duo energy with gentle humor' },
          { title: 'Narwhal and Jelly', author: 'Ben Clanton', why: 'Silly underwater odd-couple friendship in comic format' },
          { title: 'The Pigeon series', author: 'Mo Willems', why: 'Same author, same expressive humor, irresistible tantrums' },
          { title: 'Biscuit', author: 'Alyssa Satin Capucilli', why: 'Sweet, simple stories perfect for building reading confidence' },
        ],
      },
      {
        id: 'pete-the-cat',
        title: 'Pete the Cat',
        author: 'James Dean',
        description: 'A groovy blue cat who keeps his cool no matter what happens.',
        recommendations: [
          { title: 'Splat the Cat', author: 'Rob Scotton', why: 'Another lovable cat navigating school and friendship with humor' },
          { title: 'Bad Kitty', author: 'Nick Bruel', why: 'Hilarious cat antics that grow into early chapter books' },
          { title: 'Fly Guy', author: 'Tedd Arnold', why: 'A boy and his pet fly in short, funny stories with great illustrations' },
          { title: 'Dog Man', author: 'Dav Pilkey', why: 'Silly humor with graphic-novel style that reluctant readers love' },
        ],
      },
      {
        id: 'mouse-cookie',
        title: 'If You Give a Mouse a Cookie',
        author: 'Laura Numeroff',
        description: 'Cause-and-effect chain stories with charming, circular logic.',
        recommendations: [
          { title: 'Dragons Love Tacos', author: 'Adam Rubin', why: 'Same playful absurdity and kid-logic humor' },
          { title: 'The Very Hungry Caterpillar', author: 'Eric Carle', why: 'Another beloved pattern-based story with beautiful art' },
          { title: 'Bear series', author: 'Karma Wilson', why: 'Cozy, repetitive read-alouds with a lovable main character' },
          { title: 'Llama Llama', author: 'Anna Dewdney', why: 'Relatable everyday kid moments with warm rhyming text' },
        ],
      },
    ],
  },
  {
    label: 'Beginning Chapter Books',
    ages: 'Ages 5-9',
    description: 'First chapter books that keep new readers hooked',
    series: [
      {
        id: 'mercy-watson',
        title: 'Mercy Watson',
        author: 'Kate DiCamillo',
        description: 'A toast-loving pig and her adoring neighbors in laugh-out-loud adventures.',
        recommendations: [
          { title: 'Princess in Black', author: 'Shannon & Dean Hale', why: 'Dainty princess by day, monster-fighting hero by night - action and humor' },
          { title: 'Owl Diaries', author: 'Rebecca Elliott', why: 'Diary-style format with adorable illustrations, great for building stamina' },
          { title: 'Ivy + Bean', author: 'Annie Barrows', why: 'Opposites-attract friendship with mischievous schemes' },
          { title: 'Zoey and Sassafras', author: 'Asia Citro', why: 'Girl scientist helps magical creatures using the scientific method' },
        ],
      },
      {
        id: 'dragon-masters',
        title: 'Dragon Masters',
        author: 'Tracey West',
        description: 'Kids chosen to connect with dragons and protect the kingdom.',
        recommendations: [
          { title: 'Magic Tree House', author: 'Mary Pope Osborne', why: 'Adventure + history in bite-sized chapters, perfect next step' },
          { title: 'Unicorn Academy', author: 'Julie Sykes', why: 'Magical animal bonds in a fantasy school setting' },
          { title: 'The Notebook of Doom', author: 'Troy Cummings', why: 'New kid in a monster-filled town, spooky-fun with illustrations' },
          { title: 'Dragon Storm', author: 'Alastair Chisholm', why: 'Kids bonded to dragons saving their world, slightly more advanced' },
        ],
      },
      {
        id: 'dog-man',
        title: 'Dog Man',
        author: 'Dav Pilkey',
        description: 'Part dog, part police officer, all hero - in comic-book format.',
        recommendations: [
          { title: 'Cat Kid Comic Club', author: 'Dav Pilkey', why: 'Same universe! Baby frogs learn to make their own comics' },
          { title: 'InvestiGators', author: 'John Patrick Green', why: 'Gator detectives in a hilarious graphic-novel mystery series' },
          { title: 'The Bad Guys', author: 'Aaron Blabey', why: 'Villains trying to be heroes - fast, funny, and full of twists' },
          { title: 'Hilo', author: 'Judd Winick', why: 'Action-packed graphic novel about a robot boy from another world' },
        ],
      },
    ],
  },
  {
    label: 'Chapter Books & Middle Grade',
    ages: 'Ages 8-12',
    description: 'Epic series that turn kids into lifelong readers',
    series: [
      {
        id: 'harry-potter',
        title: 'Harry Potter',
        author: 'J.K. Rowling',
        description: 'A boy discovers he\'s a wizard and enters a world of magic, friendship, and adventure.',
        recommendations: [
          { title: 'Percy Jackson & the Olympians', author: 'Rick Riordan', why: 'Same found-family energy with Greek mythology woven into modern life' },
          { title: 'The Chronicles of Narnia', author: 'C.S. Lewis', why: 'Classic portal fantasy with rich worldbuilding and memorable characters' },
          { title: 'Keeper of the Lost Cities', author: 'Shannon Messenger', why: 'A girl discovers she belongs in an elven world - epic scope and twists' },
          { title: 'Nevermoor', author: 'Jessica Townsend', why: 'A cursed girl enters a magical society - whimsical and gripping' },
          { title: 'Fablehaven', author: 'Brandon Mull', why: 'Siblings discover their grandparents run a preserve for magical creatures' },
        ],
      },
      {
        id: 'percy-jackson',
        title: 'Percy Jackson',
        author: 'Rick Riordan',
        description: 'A kid with ADHD and dyslexia discovers he\'s the son of a Greek god.',
        recommendations: [
          { title: 'Magnus Chase', author: 'Rick Riordan', why: 'Same author, same humor - now with Norse mythology' },
          { title: 'The Kane Chronicles', author: 'Rick Riordan', why: 'Egyptian mythology from the same universe, dual narrators' },
          { title: 'Aru Shah', author: 'Roshani Chokshi', why: 'Hindu mythology with a wise-cracking heroine and epic quests' },
          { title: 'Wings of Fire', author: 'Tui T. Sutherland', why: 'Dragon-centric fantasy with complex politics and prophecies' },
          { title: 'The Storm Runner', author: 'J.C. Cervantes', why: 'Mayan mythology meets modern adventure, Rick Riordan approved' },
        ],
      },
      {
        id: 'diary-wimpy-kid',
        title: 'Diary of a Wimpy Kid',
        author: 'Jeff Kinney',
        description: 'Middle-school survival told through hilarious journal entries and doodles.',
        recommendations: [
          { title: 'Big Nate', author: 'Lincoln Peirce', why: 'Another illustrated diary from a kid who thinks he\'s destined for greatness' },
          { title: 'Dork Diaries', author: 'Rachel Renee Russell', why: 'Same diary-with-doodles format from a girl\'s perspective' },
          { title: 'Timmy Failure', author: 'Stephan Pastis', why: 'A self-proclaimed detective hilariously wrong about everything' },
          { title: 'The Last Kids on Earth', author: 'Max Brallier', why: 'Post-apocalyptic fun with monsters, illustrated journal style' },
        ],
      },
      {
        id: 'wings-of-fire',
        title: 'Wings of Fire',
        author: 'Tui T. Sutherland',
        description: 'Five dragonets raised in secret to fulfill a prophecy and end a war.',
        recommendations: [
          { title: 'Warriors', author: 'Erin Hunter', why: 'Clan-based animal fantasy with battles, loyalty, and prophecy' },
          { title: 'Spirit Animals', author: 'Brandon Mull et al.', why: 'Kids bonded to spirit animals saving a fantasy world' },
          { title: 'Guardians of Ga\'Hoole', author: 'Kathryn Lasky', why: 'Owl kingdoms with rich lore, battles, and coming-of-age journeys' },
          { title: 'Endling', author: 'Katherine Applegate', why: 'Last-of-her-kind creature on an epic quest, beautiful worldbuilding' },
        ],
      },
      {
        id: 'magic-tree-house',
        title: 'Magic Tree House',
        author: 'Mary Pope Osborne',
        description: 'Jack and Annie travel through time and learn history through adventure.',
        recommendations: [
          { title: 'A to Z Mysteries', author: 'Ron Roy', why: 'Kid detectives solving one mystery per letter of the alphabet' },
          { title: 'The Boxcar Children', author: 'Gertrude Chandler Warner', why: 'Resourceful siblings solving mysteries together' },
          { title: 'Geronimo Stilton', author: 'Elisabetta Dami', why: 'Mouse journalist on wacky adventures with colorful illustrated text' },
          { title: 'Who Was...? series', author: 'Various', why: 'If they love the history in MTH, these biographies go deeper' },
        ],
      },
    ],
  },
];

export const ReadAlikes = () => {
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);

  const toggleSeries = (id: string) => {
    setExpandedSeries(expandedSeries === id ? null : id);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
          <Sparkles size={14} />
          For Parents & Grandparents
        </div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
          What Should They Read Next?
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Your child just finished a series they loved. Now what? Pick the series they're hooked on
          and we'll suggest what to read next - curated by our booksellers who hear this question every day.
        </p>
      </div>

      {/* Reading levels */}
      <div className="space-y-16">
        {READING_LEVELS.map((level) => (
          <section key={level.label}>
            {/* Level header */}
            <div className="mb-8 pb-4 border-b border-border">
              <div className="flex items-baseline gap-3 mb-1">
                <h2 className="text-2xl font-serif font-bold text-primary">{level.label}</h2>
                <span className="text-sm font-bold text-accent bg-accent/10 px-3 py-0.5 rounded-full">{level.ages}</span>
              </div>
              <p className="text-sm text-muted-foreground">{level.description}</p>
            </div>

            {/* Series cards */}
            <div className="space-y-4">
              {level.series.map((series) => {
                const isExpanded = expandedSeries === series.id;
                return (
                  <div
                    key={series.id}
                    className="bg-white border border-border rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
                  >
                    {/* Series header - clickable */}
                    <button
                      onClick={() => toggleSeries(series.id)}
                      className="w-full flex items-center justify-between p-6 text-left group"
                    >
                      <div className="flex-1 mr-4">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-serif font-bold text-primary group-hover:text-accent transition-colors">
                            If they loved <span className="italic">{series.title}</span>...
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          by {series.author} &middot; {series.description}
                        </p>
                      </div>
                      <div className={`shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center transition-all ${isExpanded ? 'bg-accent text-white rotate-90' : 'text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent'}`}>
                        <ChevronRight size={18} />
                      </div>
                    </button>

                    {/* Recommendations - expandable */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-6 pt-2 border-t border-border">
                            <p className="text-xs font-bold uppercase tracking-widest text-accent mb-4">
                              Try these next
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {series.recommendations.map((rec) => (
                                <Link
                                  key={rec.title}
                                  to={`/shop?search=${encodeURIComponent(rec.title)}&category=Kids`}
                                  className="flex gap-3 p-4 bg-muted/50 rounded-xl border border-transparent hover:border-accent/20 hover:bg-accent/5 transition-all group/rec"
                                >
                                  <BookOpen size={20} className="shrink-0 mt-0.5 text-accent/50 group-hover/rec:text-accent transition-colors" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-primary text-sm group-hover/rec:text-accent transition-colors">{rec.title}</p>
                                    <p className="text-xs text-muted-foreground mb-1">by {rec.author}</p>
                                    <p className="text-xs text-muted-foreground/80 leading-relaxed">{rec.why}</p>
                                  </div>
                                  <ArrowRight size={14} className="shrink-0 mt-1 text-muted-foreground/30 group-hover/rec:text-accent transition-colors" />
                                </Link>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-20 text-center bg-muted/50 rounded-3xl border border-border p-12">
        <h3 className="text-2xl font-serif font-bold text-primary mb-3">
          Can't find what you're looking for?
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Our booksellers love helping kids find their next favorite book. Stop by the store or give us a call!
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/shop?category=Kids"
            className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            Browse All Kids Books
          </Link>
          <Link
            to="/contact"
            className="text-primary font-bold px-6 py-3 rounded-full border-2 border-primary hover:bg-primary/5 transition-all"
          >
            Ask a Bookseller
          </Link>
        </div>
      </div>
    </div>
  );
};
