import React from 'react';
import { motion } from 'framer-motion';
import { Quote, BookOpen, ChevronRight, ArrowRight, Instagram, Twitter } from 'lucide-react';
import { STAFF, BOOKS } from '@/app/utils/data';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { Link } from 'react-router';

export const StaffPicks = () => {
  return (
    <div className="pb-24">
      {/* Hero Header */}
      <section className="bg-primary text-white py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center space-x-2 bg-accent/20 text-accent px-4 py-2 rounded-full mb-8 border border-accent/30">
              <BookOpen size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Curation with Heart</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6">Meet Our Staff</h1>
            <p className="text-xl text-white/70 max-w-3xl mx-auto leading-relaxed">
              We aren't just booksellers; we're lifelong readers. Discover the stories that moved us, challenged us, and stay with us.
            </p>
          </motion.div>
        </div>
        {/* Background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -ml-48 -mb-48"></div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 space-y-32">
        {STAFF.map((member, index) => (
          <div key={member.id} className={`flex flex-col lg:flex-row gap-16 items-start ${index % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}>
            {/* Staff Profile Card */}
            <div className="lg:w-1/3 w-full sticky top-28">
              <div className="bg-white rounded-3xl border border-border shadow-xl overflow-hidden group">
                <div className="aspect-square relative overflow-hidden">
                  <ImageWithFallback src={member.photo} alt={member.name} className="w-full h-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  <div className="absolute bottom-8 left-8">
                    <h2 className="text-3xl font-serif font-bold text-white mb-1">{member.name}</h2>
                    <p className="text-accent font-bold text-sm uppercase tracking-widest">{member.role}</p>
                  </div>
                </div>
                <div className="p-10 space-y-6">
                  <p className="text-muted-foreground leading-relaxed italic">"{member.bio}"</p>
                  <div className="flex space-x-4">
                    <a href="#" className="p-2 bg-muted rounded-full text-primary hover:bg-accent hover:text-white transition-all"><Instagram size={18} /></a>
                    <a href="#" className="p-2 bg-muted rounded-full text-primary hover:bg-accent hover:text-white transition-all"><Twitter size={18} /></a>
                  </div>
                </div>
              </div>
            </div>

            {/* Picks List */}
            <div className="flex-1 space-y-12">
              <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
                <h3 className="text-2xl font-serif font-bold text-primary">{member.name.split(' ')[0]}'s Top Picks</h3>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Last Updated: Jan 2026</span>
              </div>

              <div className="space-y-12">
                {member.topPicks.map((bookId, i) => {
                  const book = BOOKS.find(b => b.id === bookId);
                  if (!book) return null;
                  return (
                    <motion.div 
                      key={bookId} 
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex gap-8 group"
                    >
                      <div className="text-5xl font-serif font-bold text-accent/20 shrink-0 tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="w-32 aspect-[2/3] shrink-0 rounded-lg shadow-md overflow-hidden transition-transform group-hover:-translate-y-2">
                        <Link to={`/book/${book.id}`}>
                          <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                        </Link>
                      </div>
                      <div className="flex-1 py-2">
                        <Link to={`/book/${book.id}`}>
                          <h4 className="text-2xl font-serif font-bold text-primary mb-1 group-hover:text-accent transition-colors">{book.title}</h4>
                        </Link>
                        <p className="text-muted-foreground mb-6 font-medium italic">by {book.author}</p>
                        
                        <div className="flex items-center space-x-6">
                          <p className="font-bold text-primary text-xl">${book.price.toFixed(2)}</p>
                          <Link to={`/book/${book.id}`} className="text-xs font-bold uppercase tracking-widest text-accent flex items-center hover:underline">
                            View Details <ChevronRight size={14} className="ml-1" />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="pt-12">
                <Link 
                  to="/shop" 
                  className="inline-flex items-center space-x-3 bg-muted px-10 py-5 rounded-2xl border border-border text-primary font-bold hover:bg-white hover:shadow-xl transition-all"
                >
                  <span>View Full Curation from {member.name.split(' ')[0]}</span>
                  <ArrowRight size={20} className="text-accent" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
