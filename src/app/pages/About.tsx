import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Instagram, Facebook, BookOpen, Heart, Users, CalendarDays, Star, Quote } from 'lucide-react';
import { Link } from 'react-router';
import { STORE } from '@/lib/storeConfig';
import { CUSTOMER_REVIEWS, GOOGLE_REVIEWS_URL } from '@/lib/reviews';

const MAP_EMBED = `https://www.google.com/maps?q=${encodeURIComponent(`The Bookworm, ${STORE.address.full}`)}&output=embed`;

const AT_A_GLANCE = [
  { icon: BookOpen, title: `Since ${STORE.foundedYear}`, text: 'Over fifty years of putting the right book in the right hands.' },
  { icon: Heart, title: 'Woman-owned, always', text: 'From the day we opened to today.' },
  { icon: Users, title: 'Independent', text: "Every book on our shelves was chosen by a bookseller, not an algorithm." },
];

const WHAT_WE_DO = [
  { icon: BookOpen, title: 'A curated selection', text: "Fiction, nonfiction, children's books and timeless classics - chosen with care, with something for every kind of reader.", to: '/shop', cta: 'Browse the shelves' },
  { icon: Heart, title: 'The right book for you', text: "Tell us what you loved last and we'll find what you'll love next. And if it isn't on the shelf, we're happy to order it.", to: '/staff-picks', cta: 'See our staff picks' },
  { icon: CalendarDays, title: 'Book clubs & events', text: 'Author signings, story times, and book clubs for fantasy, fiction and sci-fi readers. New faces are always welcome.', to: '/events', cta: "See what's coming up" },
];

export const About = () => {
  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="bg-primary text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-5">Camarillo, California · Est. {STORE.foundedYear}</p>
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6">Our Story</h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
              Camarillo's independent, woman-owned bookstore - a cornerstone of the community since {STORE.foundedYear}.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-14 items-center">
          <div className="lg:col-span-3 space-y-6">
            <h2 className="text-4xl font-serif font-bold text-primary">A quaint literary haven in the heart of Camarillo</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              The Bookworm opened its doors in {STORE.foundedYear}, and it has been woman-owned every day since. For more than fifty years
              we've been a cornerstone of the Camarillo community, with a thoughtfully curated selection of books that spark the
              imagination and nurture the soul.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Stepping inside feels a little like stepping into another world, where every corner holds a new treasure waiting to
              be uncovered. Our shelves span fiction, nonfiction, children's books and timeless classics, so there is something
              here for every kind of reader.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Our booksellers are always ready to help you find that perfect book - just as Ollivander guided Harry Potter to his
              wand. Whether you're after your next page-turner, a heartfelt gift, or inspiration for your book club, we're here
              to make the search part of the pleasure.
            </p>
          </div>
          <div className="lg:col-span-2">
            <img
              src="/brand/mascot.png"
              alt="The Bookworm's mascot: a green bookworm in round glasses and a pink scarf, reading a book beside a cup of coffee"
              width={900}
              height={940}
              loading="lazy"
              className="w-full max-w-sm mx-auto h-auto"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-16">
          {AT_A_GLANCE.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start space-x-4">
              <div className="p-3 bg-accent/10 rounded-xl text-accent shrink-0"><Icon size={24} /></div>
              <div>
                <p className="font-bold text-primary">{title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* What you'll find */}
      <section className="bg-muted py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-serif font-bold text-primary mb-4">What you'll find here</h2>
            <div className="w-24 h-1 bg-accent mx-auto"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {WHAT_WE_DO.map(({ icon: Icon, title, text, to, cta }) => (
              <div key={title} className="bg-white p-9 rounded-3xl border border-border text-center flex flex-col">
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-accent">
                  <Icon size={32} />
                </div>
                <h3 className="text-2xl font-serif font-bold text-primary mb-3">{title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-5 flex-1">{text}</p>
                <Link to={to} className="text-primary font-medium underline underline-offset-4 hover:no-underline">{cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews - real ones only; see src/lib/reviews.ts */}
      {CUSTOMER_REVIEWS.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-serif font-bold text-primary mb-4">In our customers' words</h2>
            <div className="w-24 h-1 bg-accent mx-auto"></div>
          </div>
          <div className={`grid grid-cols-1 gap-6 ${CUSTOMER_REVIEWS.length > 1 ? 'md:grid-cols-2 lg:grid-cols-3' : 'max-w-xl mx-auto'}`}>
            {CUSTOMER_REVIEWS.map((review) => (
              <figure key={review.quote} className="bg-white p-8 rounded-2xl border border-border">
                <Quote size={24} className="text-accent/40 mb-3" />
                <blockquote className="font-serif italic text-lg text-primary leading-relaxed">"{review.quote}"</blockquote>
                <figcaption className="text-xs font-bold text-accent uppercase tracking-wide mt-4">
                  - {review.name ? `${review.name}, ` : ''}{review.source} review
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="text-center mt-8">
            <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary font-medium underline underline-offset-4 hover:no-underline">
              <Star size={16} /> Read more reviews on Google - or leave us one
            </a>
          </p>
        </section>
      )}

      {/* Location & Info */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4 space-y-10">
            <div>
              <h2 className="text-2xl font-serif font-bold text-primary mb-6">Find Us</h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <MapPin className="text-accent mt-1" size={20} />
                  <div>
                    <p className="font-bold text-primary">Las Posas Plaza</p>
                    <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline">
                      {STORE.address.line1}<br />{STORE.address.city}, {STORE.address.state} {STORE.address.zip}
                    </a>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Clock className="text-accent mt-1" size={20} />
                  <div>
                    <p className="font-bold text-primary">Opening Hours</p>
                    <ul className="text-muted-foreground text-sm space-y-1">
                      {Object.entries(STORE.hours).map(([day, time]) => (
                        <li key={day} className="flex justify-between w-48"><span>{day}:</span> <span>{time}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Phone className="text-accent mt-1" size={20} />
                  <div>
                    <p className="font-bold text-primary">Call Us</p>
                    <a href={STORE.phoneTel} className="text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline">{STORE.phone}</a>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-serif font-bold text-primary mb-3">Stay Connected</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Follow along for sales and special events, or <Link to="/newsletter" className="underline text-primary">get our newsletter</Link>.
              </p>
              <div className="flex space-x-4">
                <a href={STORE.social.instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="p-3 bg-muted rounded-xl text-primary hover:bg-accent hover:text-white transition-all"><Instagram size={24} /></a>
                <a href={STORE.social.facebook} aria-label="Facebook" target="_blank" rel="noopener noreferrer" className="p-3 bg-muted rounded-xl text-primary hover:bg-accent hover:text-white transition-all"><Facebook size={24} /></a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="w-full h-[420px] rounded-3xl overflow-hidden bg-muted border border-border">
              <iframe
                title="Map showing The Bookworm at 93 E Daily Dr, Camarillo"
                src={MAP_EMBED}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="bg-primary p-12 md:p-16 rounded-3xl text-center text-white">
          <h2 className="text-4xl font-serif font-bold mb-5">Come in and say hello</h2>
          <p className="text-xl text-white/70 mb-9 max-w-2xl mx-auto">
            Stories come to life here, and every visit is a small adventure. We can't wait to help you find your next favorite book.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/shop" className="bg-white text-primary px-9 py-4 rounded-xl font-bold hover:bg-white/90 transition-all">Browse Books</Link>
            <Link to="/events" className="bg-white/10 border border-white/20 px-9 py-4 rounded-xl font-bold hover:bg-white/20 transition-all">Upcoming Events</Link>
          </div>
        </div>
      </section>
    </div>
  );
};
