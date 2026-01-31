import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, Clock, Instagram, Facebook, Twitter, Award, Users, BookOpen, Heart } from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { Link } from 'react-router';

export const About = () => {
  return (
    <div className="pb-24">
      {/* Hero Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <ImageWithFallback src="https://images.unsplash.com/photo-1761384979966-546eb28f60a7?auto=format&fit=crop&q=80&w=1920" alt="Bookstore Interior" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-primary/90 mix-blend-multiply"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-7xl font-serif font-bold mb-8">Our Story</h1>
            <p className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed">
              Serving the Camarillo community with curated literature and local heart for over 50 years.
            </p>
          </motion.div>
        </div>
      </section>

      {/* History Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl font-serif font-bold text-primary">A Legacy of Literacy</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Camarillo Bookworm opened its doors in 1973 with a simple mission: to provide a sanctuary for readers and a hub for the local community. What started as a small, one-room shop has grown into one of the region's most beloved independent bookstores.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Throughout five decades, we have remained independent and family-owned, weathering the shifts in the industry by staying true to our roots—personalized recommendations, a carefully curated selection, and a deep love for the Camarillo community.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-8">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-accent/10 rounded-xl text-accent"><Award size={24} /></div>
                <div>
                  <p className="font-bold text-primary">50+ Years</p>
                  <p className="text-sm text-muted-foreground">In Business</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-accent/10 rounded-xl text-accent"><Users size={24} /></div>
                <div>
                  <p className="font-bold text-primary">Community First</p>
                  <p className="text-sm text-muted-foreground">Local Focus</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl">
              <ImageWithFallback src="https://images.unsplash.com/photo-1641411002123-ea633f5c5be3?auto=format&fit=crop&q=80&w=1200" alt="Old Bookstore Photo" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-10 -left-10 bg-white p-8 rounded-2xl shadow-xl border border-border hidden md:block max-w-xs">
              <p className="font-serif italic text-primary">
                "Camarillo Bookworm is more than just a store; it's the heart of our neighborhood."
              </p>
              <p className="text-xs font-bold text-accent uppercase mt-4">— Longtime Customer</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-muted py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-serif font-bold text-primary mb-4">What We Believe In</h2>
            <div className="w-24 h-1 bg-accent mx-auto"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: <BookOpen className="text-accent" />, title: "The Power of Stories", desc: "We believe literature has the power to build empathy, expand horizons, and change lives." },
              { icon: <Users className="text-accent" />, title: "Community Hub", desc: "We strive to be a welcoming space where neighbors can gather, discuss, and celebrate together." },
              { icon: <Heart className="text-accent" />, title: "Independent Spirit", desc: "We support fellow local businesses and believe in the importance of independent curation." }
            ].map((value, i) => (
              <div key={i} className="bg-white p-10 rounded-3xl border border-border text-center space-y-4 hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  {React.cloneElement(value.icon as React.ReactElement, { size: 32 })}
                </div>
                <h3 className="text-2xl font-serif font-bold text-primary">{value.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location & Info */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-4 space-y-12">
            <div>
              <h3 className="text-2xl font-serif font-bold text-primary mb-6">Find Us</h3>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <MapPin className="text-accent mt-1" size={20} />
                  <div>
                    <p className="font-bold text-primary">Store Address</p>
                    <p className="text-muted-foreground">123 Literary Way<br />Camarillo, CA 93010</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Clock className="text-accent mt-1" size={20} />
                  <div>
                    <p className="font-bold text-primary">Opening Hours</p>
                    <ul className="text-muted-foreground text-sm space-y-1">
                      <li className="flex justify-between w-48"><span>Mon – Fri:</span> <span>9am – 8pm</span></li>
                      <li className="flex justify-between w-48"><span>Saturday:</span> <span>10am – 9pm</span></li>
                      <li className="flex justify-between w-48"><span>Sunday:</span> <span>11am – 6pm</span></li>
                    </ul>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Phone className="text-accent mt-1" size={20} />
                  <div>
                    <p className="font-bold text-primary">Call Us</p>
                    <p className="text-muted-foreground">(805) 482-1384</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-serif font-bold text-primary mb-6">Stay Connected</h3>
              <div className="flex space-x-4">
                <a href="#" className="p-3 bg-muted rounded-xl text-primary hover:bg-accent hover:text-white transition-all"><Instagram size={24} /></a>
                <a href="#" className="p-3 bg-muted rounded-xl text-primary hover:bg-accent hover:text-white transition-all"><Facebook size={24} /></a>
                <a href="#" className="p-3 bg-muted rounded-xl text-primary hover:bg-accent hover:text-white transition-all"><Twitter size={24} /></a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="w-full h-[500px] rounded-3xl overflow-hidden bg-muted border border-border relative">
              {/* Mock Map */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <MapPin size={48} className="text-accent mx-auto animate-bounce" />
                  <p className="font-bold text-primary">Camarillo Bookworm</p>
                  <p className="text-xs text-muted-foreground">Interactive Map Placeholder</p>
                </div>
              </div>
              <ImageWithFallback src="https://images.unsplash.com/photo-1761384979966-546eb28f60a7?auto=format&fit=crop&q=80&w=1200" alt="Map background" className="w-full h-full object-cover opacity-20 grayscale" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="bg-primary p-16 rounded-3xl text-center text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl font-serif font-bold mb-6">Ready to find your next read?</h2>
            <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto">
              Visit us in person or explore our curated selection online. We can't wait to help you find your new favorite book.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/shop" className="bg-accent text-white px-10 py-4 rounded-xl font-bold hover:bg-accent/90 transition-all">
                Shop the Catalog
              </Link>
              <Link to="/staff-picks" className="bg-white/10 backdrop-blur-md border border-white/20 px-10 py-4 rounded-xl font-bold hover:bg-white/20 transition-all">
                Meet the Staff
              </Link>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/20 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/20 rounded-full -ml-32 -mb-32 blur-3xl"></div>
        </div>
      </section>
    </div>
  );
};
