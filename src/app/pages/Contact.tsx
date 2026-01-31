import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Send, HelpCircle, Loader2, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('contact_submissions').insert({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        subject: formData.subject,
        message: formData.message,
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Message sent! We'll get back to you within 24 hours.");
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: 'General Inquiry',
        message: '',
      });
    } catch (err) {
      console.error('Contact form error:', err);
      toast.error('Failed to send message. Please try again or call us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-24">
      <section className="bg-muted py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-serif font-bold text-primary mb-6">Get in Touch</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Have a question about a book, an event, or an order? We're here to help.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Contact Info */}
          <div className="lg:col-span-5 space-y-12">
            <div className="space-y-8">
              <h2 className="text-3xl font-serif font-bold text-primary">Contact Information</h2>
              <div className="space-y-6">
                <a
                  href="tel:+18055550123"
                  className="flex items-start space-x-6 p-6 bg-white rounded-2xl border border-border hover:border-accent transition-colors group"
                >
                  <div className="p-4 bg-accent/10 rounded-xl text-accent group-hover:bg-accent group-hover:text-white transition-all"><Phone size={24} /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Call Us</p>
                    <p className="text-xl font-bold text-primary">(805) 555-0123</p>
                  </div>
                </a>
                <a
                  href="mailto:hello@camarillobookworm.com"
                  className="flex items-start space-x-6 p-6 bg-white rounded-2xl border border-border hover:border-accent transition-colors group"
                >
                  <div className="p-4 bg-accent/10 rounded-xl text-accent group-hover:bg-accent group-hover:text-white transition-all"><Mail size={24} /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Email Us</p>
                    <p className="text-xl font-bold text-primary">hello@camarillobookworm.com</p>
                  </div>
                </a>
                <a
                  href="https://maps.google.com/?q=123+Mission+Oaks+Blvd+Camarillo+CA+93012"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start space-x-6 p-6 bg-white rounded-2xl border border-border hover:border-accent transition-colors group"
                >
                  <div className="p-4 bg-accent/10 rounded-xl text-accent group-hover:bg-accent group-hover:text-white transition-all"><MapPin size={24} /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Visit Us</p>
                    <p className="text-xl font-bold text-primary">123 Mission Oaks Blvd<br />Camarillo, CA 93012</p>
                    <p className="text-sm text-accent mt-2 flex items-center">
                      Get directions <ExternalLink size={12} className="ml-1" />
                    </p>
                  </div>
                </a>
                <div className="flex items-start space-x-6 p-6 bg-white rounded-2xl border border-border">
                  <div className="p-4 bg-accent/10 rounded-xl text-accent"><Clock size={24} /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Store Hours</p>
                    <div className="text-primary">
                      <p className="font-medium">Monday - Saturday: 10am - 8pm</p>
                      <p className="font-medium">Sunday: 11am - 6pm</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary p-10 rounded-3xl text-white relative overflow-hidden">
              <h3 className="text-2xl font-serif font-bold mb-4 relative z-10">Frequently Asked Questions</h3>
              <div className="space-y-6 relative z-10">
                <div className="space-y-2">
                  <p className="font-bold flex items-center"><HelpCircle size={16} className="mr-2 text-accent" /> Do you buy used books?</p>
                  <p className="text-sm text-white/70">Yes! We evaluate used books for store credit every Tuesday and Thursday from 10am to 4pm.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold flex items-center"><HelpCircle size={16} className="mr-2 text-accent" /> Can I order a book not in stock?</p>
                  <p className="text-sm text-white/70">Absolutely. Special orders typically arrive within 3-5 business days at no extra cost.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold flex items-center"><HelpCircle size={16} className="mr-2 text-accent" /> Do you host author events?</p>
                  <p className="text-sm text-white/70">Yes! We host over 100 author events, book clubs, and story times each year. Check our Events page for upcoming programs.</p>
                </div>
              </div>
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-accent/20 rounded-full blur-3xl"></div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-7">
            <div className="bg-white p-10 md:p-16 rounded-3xl border border-border shadow-2xl">
              <h2 className="text-3xl font-serif font-bold text-primary mb-8">Send a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-5 py-4 bg-muted/30 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-5 py-4 bg-muted/30 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone (optional)</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-5 py-4 bg-muted/30 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                      placeholder="(805) 555-0123"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-5 py-4 bg-muted/30 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all appearance-none"
                    >
                      <option>General Inquiry</option>
                      <option>Order Status</option>
                      <option>Special Order Request</option>
                      <option>Event Question</option>
                      <option>Book Recommendation</option>
                      <option>Gift Cards</option>
                      <option>Media/Press</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your Message *</label>
                  <textarea
                    rows={6}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-5 py-4 bg-muted/30 border border-border rounded-xl outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
                    placeholder="Tell us what's on your mind..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center space-x-3 hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
                <p className="text-xs text-center text-muted-foreground">
                  We typically respond within 24 hours during business days.
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div className="mt-24">
          <div className="bg-muted rounded-3xl overflow-hidden border border-border h-[400px] relative">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d52882.55726992879!2d-119.0800!3d34.2208!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80e83c5e7c8d1c67%3A0x8b5c0f9c1e5f5c8a!2sCamarillo%2C%20CA!5e0!3m2!1sen!2sus!4v1234567890"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0"
            />
            <div className="absolute bottom-6 left-6 bg-white p-4 rounded-xl shadow-lg">
              <p className="font-bold text-primary">Camarillo Bookworm</p>
              <p className="text-sm text-muted-foreground">123 Mission Oaks Blvd</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
