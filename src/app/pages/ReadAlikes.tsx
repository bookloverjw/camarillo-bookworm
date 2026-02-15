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
  {
    label: 'YA Fantasy, Sci-Fi & Dystopian',
    ages: 'Ages 12+',
    description: 'World-shaking adventures for teens who devour books',
    series: [
      {
        id: 'hunger-games',
        title: 'The Hunger Games',
        author: 'Suzanne Collins',
        description: 'Katniss volunteers to fight to the death in a televised spectacle that sparks a revolution.',
        recommendations: [
          { title: 'Divergent', author: 'Veronica Roth', why: 'Another fierce heroine fighting a society built on control and conformity' },
          { title: 'The Maze Runner', author: 'James Dashner', why: 'Teens with wiped memories must survive and escape a deadly maze' },
          { title: 'Legend', author: 'Marie Lu', why: 'Two teens on opposite sides of a future war, fast-paced with big twists' },
          { title: 'Red Queen', author: 'Victoria Aveyard', why: 'A girl discovers hidden powers in a society divided by blood' },
        ],
      },
      {
        id: 'shadow-and-bone',
        title: 'Shadow and Bone',
        author: 'Leigh Bardugo',
        description: 'A mapmaker discovers a power that could destroy the Shadow Fold and change her world forever.',
        recommendations: [
          { title: 'Six of Crows', author: 'Leigh Bardugo', why: 'Same universe! A crew of outcasts pulls off an impossible heist - even better' },
          { title: 'An Ember in the Ashes', author: 'Sabaa Tahir', why: 'Epic dual-POV fantasy with oppression, rebellion, and gut-punch twists' },
          { title: 'Children of Blood and Bone', author: 'Tomi Adeyemi', why: 'West African-inspired fantasy about a girl fighting to restore magic' },
          { title: 'Throne of Glass', author: 'Sarah J. Maas', why: 'An assassin enters a deadly competition in a corrupt kingdom' },
        ],
      },
      {
        id: 'his-dark-materials',
        title: 'His Dark Materials',
        author: 'Philip Pullman',
        description: 'Lyra journeys between parallel worlds with her daemon to uncover cosmic truths.',
        recommendations: [
          { title: 'The Giver Quartet', author: 'Lois Lowry', why: 'A boy discovers his perfect community hides terrible secrets - a modern classic' },
          { title: 'Miss Peregrine\'s Home for Peculiar Children', author: 'Ransom Riggs', why: 'A hidden world of children with extraordinary abilities and vintage photos' },
          { title: 'Sabriel', author: 'Garth Nix', why: 'A young woman crosses into the realm of the dead to save her father' },
          { title: 'The Book Thief', author: 'Markus Zusak', why: 'A girl finds solace in stolen books during WWII, narrated by Death' },
        ],
      },
      {
        id: 'lunar-chronicles',
        title: 'The Lunar Chronicles',
        author: 'Marissa Meyer',
        description: 'Fairy tale retellings set in a futuristic world with cyborgs, hackers, and space travel.',
        recommendations: [
          { title: 'Heartless', author: 'Marissa Meyer', why: 'Same author reimagines the Queen of Hearts\' tragic origin story' },
          { title: 'Caraval', author: 'Stephanie Garber', why: 'Two sisters enter a magical game where nothing is what it seems' },
          { title: 'The Selection', author: 'Kiera Cass', why: 'Cinderella meets The Bachelor in a dystopian competition for a prince' },
          { title: 'Spin the Dawn', author: 'Elizabeth Lim', why: 'Mulan-meets-Project Runway in a lush fantasy with impossible dresses' },
        ],
      },
      {
        id: 'scythe',
        title: 'Scythe',
        author: 'Neal Shusterman',
        description: 'In a world where death has been conquered, scythes are tasked with controlling the population.',
        recommendations: [
          { title: 'The Maze Runner', author: 'James Dashner', why: 'Another high-stakes survival story that questions who controls humanity' },
          { title: 'Unwind', author: 'Neal Shusterman', why: 'Same author - teens can be retroactively "unwound" for their body parts' },
          { title: 'The 5th Wave', author: 'Rick Yancey', why: 'Alien invasion pushes teens to survive wave after wave of extinction events' },
          { title: 'Illuminae', author: 'Amie Kaufman & Jay Kristoff', why: 'Told through hacked files and AI transcripts - sci-fi at breakneck pace' },
        ],
      },
      {
        id: 'the-diviners',
        title: 'The Diviners',
        author: 'Libba Bray',
        description: 'A girl with supernatural powers hunts a serial killer in Jazz Age New York City.',
        recommendations: [
          { title: 'Legendborn', author: 'Tracy Deonn', why: 'Secret magical society rooted in Arthurian legend with a stunning twist' },
          { title: 'Stalking Jack the Ripper', author: 'Kerri Maniscalco', why: 'Gothic historical mystery with a fearless heroine and forensic science' },
          { title: 'Jackaby', author: 'William Ritter', why: 'Sherlock Holmes meets Doctor Who in a supernatural detective series' },
          { title: 'The Gilded Wolves', author: 'Roshani Chokshi', why: 'A heist crew in 1889 Paris where history hides magic and dark secrets' },
        ],
      },
    ],
  },
  {
    label: 'YA Contemporary, Romance & Mystery',
    ages: 'Ages 13+',
    description: 'Real-world stories with heart, humor, and page-turning suspense',
    series: [
      {
        id: 'inheritance-games',
        title: 'The Inheritance Games',
        author: 'Jennifer Lynn Barnes',
        description: 'A teen inherits a billionaire\'s fortune and must solve puzzles and survive a powerful family to keep it.',
        recommendations: [
          { title: 'One of Us Is Lying', author: 'Karen M. McManus', why: 'Five students in detention, one dies - a twisty whodunit for teens' },
          { title: 'Truly Devious', author: 'Maureen Johnson', why: 'A cold case at an elite boarding school with puzzle-box plotting' },
          { title: 'A Good Girl\'s Guide to Murder', author: 'Holly Jackson', why: 'A teen reopens a closed murder case and uncovers shocking truths' },
          { title: 'The Naturals', author: 'Jennifer Lynn Barnes', why: 'Same author - teen criminal profiler recruited by the FBI' },
        ],
      },
      {
        id: 'summer-turned-pretty',
        title: 'The Summer I Turned Pretty',
        author: 'Jenny Han',
        description: 'A love triangle unfolds across summers at a beach house that holds a lifetime of memories.',
        recommendations: [
          { title: 'To All the Boys I\'ve Loved Before', author: 'Jenny Han', why: 'Same author - secret love letters accidentally get mailed out' },
          { title: 'The Fault in Our Stars', author: 'John Green', why: 'Two teens with cancer fall in love - devastating, funny, and beautiful' },
          { title: 'We Were Liars', author: 'E. Lockhart', why: 'A wealthy family, a summer island, and a secret that changes everything' },
          { title: 'Beach Read', author: 'Emily Henry', why: 'Two writers swap genres for a summer - witty banter and real emotion' },
        ],
      },
      {
        id: 'they-both-die',
        title: 'They Both Die at the End',
        author: 'Adam Silvera',
        description: 'Two strangers spend their final day alive together after receiving their death notice.',
        recommendations: [
          { title: 'The Hate U Give', author: 'Angie Thomas', why: 'A teen witnesses police violence and must find the courage to speak up' },
          { title: 'Simon vs. the Homo Sapiens Agenda', author: 'Becky Albertalli', why: 'A closeted teen gets blackmailed over his secret emails - warm and affirming' },
          { title: 'Aristotle and Dante Discover the Secrets of the Universe', author: 'Benjamin Alire Saenz', why: 'Two Mexican-American teens forge a life-changing bond one desert summer' },
          { title: 'More Happy Than Not', author: 'Adam Silvera', why: 'Same author - a boy considers memory alteration to forget his heartbreak' },
        ],
      },
      {
        id: 'one-of-us-lying',
        title: 'One of Us Is Lying',
        author: 'Karen M. McManus',
        description: 'Five students walk into detention. Only four walk out alive. Everyone is a suspect.',
        recommendations: [
          { title: 'A Good Girl\'s Guide to Murder', author: 'Holly Jackson', why: 'A school-project investigation that spirals into real danger' },
          { title: 'Truly Devious', author: 'Maureen Johnson', why: 'A decades-old mystery at a Vermont boarding school with modern parallels' },
          { title: 'Two Can Keep a Secret', author: 'Karen M. McManus', why: 'Same author - twins arrive in a small town with a dark history' },
          { title: 'People Like Us', author: 'Dana Mele', why: 'A murder at an elite prep school and everyone has something to hide' },
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
          For Parents, Grandparents & Teen Readers
        </div>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
          What Should They Read Next?
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Finished a series and need the next obsession? Pick the series they're hooked on
          and we'll suggest what to read next - curated by our booksellers who hear this question every day.
        </p>
      </div>

      {/* Reading levels */}
      <div className="space-y-16">
        {READING_LEVELS.map((level) => {
          const isYA = level.label.startsWith('YA');
          const shopCategory = isYA ? 'YA' : 'Kids';
          return (
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
                                    to={`/shop?search=${encodeURIComponent(rec.title)}&category=${shopCategory}`}
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
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="mt-20 text-center bg-muted/50 rounded-3xl border border-border p-12">
        <h3 className="text-2xl font-serif font-bold text-primary mb-3">
          Can't find what you're looking for?
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Our booksellers love matching readers with their next favorite book. Stop by the store or give us a call!
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/shop?category=Kids"
            className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            Browse Kids Books
          </Link>
          <Link
            to="/shop?category=YA"
            className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            Browse YA Books
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
