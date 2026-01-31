import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, List as ListIcon, MapPin, Clock, ChevronLeft, ChevronRight, Share2, Plus, ArrowRight, X, User, Mail, Phone, Users, Loader2, CheckCircle } from 'lucide-react';
import { EVENTS, BOOKS } from '@/app/utils/data';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/context/AuthContext';

interface RegistrationModalProps {
  event: typeof EVENTS[0];
  onClose: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ event, onClose }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    guests: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('event_registrations').insert({
        event_id: event.id,
        customer_id: user?.id || null,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone || null,
        guests: formData.guests,
        status: 'registered',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === '23505') {
          toast.error("You're already registered for this event!");
        } else {
          throw error;
        }
      } else {
        setIsSuccess(true);
        toast.success('Registration confirmed!');
      }
    } catch (err) {
      console.error('Registration error:', err);
      toast.error('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-primary mb-2">You're Registered!</h2>
          <p className="text-muted-foreground mb-6">
            We've sent a confirmation email to {formData.email}. We look forward to seeing you!
          </p>
          <div className="bg-muted p-4 rounded-xl mb-6">
            <p className="text-sm font-bold text-primary">{event.title}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {event.time}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all"
          >
            Done
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        {/* Header */}
        <div className="bg-primary text-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Register for Event</p>
              <h2 className="text-xl font-serif font-bold">{event.title}</h2>
              <p className="text-sm opacity-80 mt-1">
                {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at {event.time}
              </p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">First Name *</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-1 focus:ring-accent outline-none text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Last Name *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-1 focus:ring-accent outline-none text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">Email *</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-1 focus:ring-accent outline-none text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">Phone (optional)</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-1 focus:ring-accent outline-none text-sm"
                placeholder="(805) 555-0123"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">Number of Guests</label>
            <div className="relative">
              <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select
                value={formData.guests}
                onChange={(e) => setFormData({ ...formData, guests: parseInt(e.target.value) })}
                className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-1 focus:ring-accent outline-none text-sm bg-white"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-accent text-white py-3 rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Registering...</span>
              </>
            ) : (
              <span>Complete Registration</span>
            )}
          </button>

          <p className="text-[10px] text-center text-muted-foreground">
            By registering, you agree to receive event reminders via email.
          </p>
        </form>
      </motion.div>
    </motion.div>
  );
};

export const Events = () => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 1, 1)); // Feb 2026
  const [selectedEvent, setSelectedEvent] = useState<typeof EVENTS[0] | null>(null);

  const getEventTypeBadge = (type: string) => {
    switch (type) {
      case 'Author Reading': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Book Club': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Kids Story Time': return 'bg-green-100 text-green-700 border-green-200';
      case 'Workshop': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Signing': return 'bg-pink-100 text-pink-700 border-pink-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const handleAddToCalendar = (event: typeof EVENTS[0]) => {
    const startDate = new Date(`${event.date}T${event.time.replace(' PM', ':00').replace(' AM', ':00')}`);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${event.title}
DESCRIPTION:${event.description}
LOCATION:Camarillo Bookworm - 123 Mission Oaks Blvd, Camarillo, CA 93012
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/\s+/g, '-')}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Calendar event downloaded!');
  };

  const handleShare = async (event: typeof EVENTS[0]) => {
    const shareData = {
      title: event.title,
      text: `Join me at "${event.title}" at Camarillo Bookworm on ${new Date(event.date).toLocaleDateString()}!`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        toast.success('Event link copied!');
      }
    } catch (err) {
      // User cancelled
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 pb-8 border-b border-border">
        <div>
          <h1 className="text-5xl font-serif font-bold text-primary mb-4">Events Calendar</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            From intimate author readings to lively book clubs, there's always something happening at Camarillo Bookworm.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="bg-muted p-1 rounded-lg flex">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              <CalendarIcon size={18} />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              <ListIcon size={18} />
              <span>List View</span>
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 border border-border rounded-md hover:bg-muted transition-colors"><ChevronLeft size={20} /></button>
            <span className="font-bold text-primary px-4">February 2026</span>
            <button className="p-2 border border-border rounded-md hover:bg-muted transition-colors"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {EVENTS.map((event) => {
              const featuredBook = BOOKS.find(b => b.id === event.featuredBookId);
              return (
                <div key={event.id} className="group flex flex-col lg:flex-row gap-8 bg-white p-8 rounded-2xl border border-border shadow-sm hover:shadow-xl transition-all">
                  {/* Date Block */}
                  <div className="shrink-0 flex flex-col items-center justify-center w-24 h-24 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-3xl font-bold">
                      {new Date(event.date).getDate()}
                    </span>
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${getEventTypeBadge(event.type)}`}>
                        {event.type}
                      </span>
                      <span className="flex items-center space-x-1 text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded">
                        <MapPin size={12} />
                        <span>{event.location}</span>
                      </span>
                      <span className="flex items-center space-x-1 text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded">
                        <Clock size={12} />
                        <span>{event.time}</span>
                      </span>
                    </div>

                    <h2 className="text-3xl font-serif font-bold text-primary group-hover:text-accent transition-colors">{event.title}</h2>
                    <p className="text-muted-foreground leading-relaxed max-w-2xl">{event.description}</p>

                    <div className="flex flex-wrap gap-4 pt-4">
                      <button
                        onClick={() => setSelectedEvent(event)}
                        className="bg-primary text-white px-8 py-3 rounded-md font-bold hover:bg-primary/90 transition-all"
                      >
                        Register / RSVP
                      </button>
                      <button
                        onClick={() => handleAddToCalendar(event)}
                        className="flex items-center space-x-2 text-primary font-bold hover:underline"
                      >
                        <Plus size={18} />
                        <span>Add to Calendar</span>
                      </button>
                      <button
                        onClick={() => handleShare(event)}
                        className="flex items-center space-x-2 text-primary font-bold hover:underline"
                      >
                        <Share2 size={18} />
                        <span>Share Event</span>
                      </button>
                    </div>
                  </div>

                  {/* Featured Book */}
                  {featuredBook && (
                    <div className="lg:w-64 bg-muted/30 p-4 rounded-xl border border-border">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Featured Book</p>
                      <div className="flex items-start space-x-4">
                        <div className="w-16 aspect-[2/3] shrink-0 rounded shadow-sm overflow-hidden">
                          <ImageWithFallback src={featuredBook.cover} alt={featuredBook.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="font-serif font-bold text-sm text-primary line-clamp-2 leading-tight mb-1">{featuredBook.title}</h4>
                          <p className="text-xs text-muted-foreground mb-3">{featuredBook.author}</p>
                          <Link to={`/book/${featuredBook.id}`} className="text-[10px] font-bold text-accent uppercase flex items-center hover:underline">
                            Shop Book <ArrowRight size={12} className="ml-1" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm"
          >
            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-4 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground border-r border-border last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid Body (Mock for Feb 2026) */}
            <div className="grid grid-cols-7 grid-rows-5">
              {Array.from({ length: 35 }).map((_, i) => {
                const day = i - 0; // Feb 1, 2026 is Sunday
                const isCurrentMonth = day >= 1 && day <= 28;
                const eventsOnThisDay = EVENTS.filter(e => new Date(e.date).getDate() === day);

                return (
                  <div key={i} className={`min-h-[140px] p-3 border-r border-b border-border last:border-r-0 flex flex-col ${!isCurrentMonth ? 'bg-muted/10' : ''}`}>
                    <span className={`text-sm font-bold mb-2 ${!isCurrentMonth ? 'text-muted-foreground/30' : 'text-primary'}`}>
                      {day > 0 && day <= 28 ? day : day <= 0 ? 31 + day : day - 28}
                    </span>
                    <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
                      {isCurrentMonth && eventsOnThisDay.map(event => (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`px-2 py-1 rounded text-[10px] font-bold leading-tight cursor-pointer truncate hover:brightness-95 transition-all ${getEventTypeBadge(event.type)}`}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar Legend */}
      <div className="mt-12 flex flex-wrap gap-8 justify-center items-center bg-muted/30 p-6 rounded-xl border border-border">
        <p className="text-sm font-bold text-primary mr-4">Legend:</p>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div>
          <span className="text-xs font-medium text-muted-foreground">Author Reading</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
          <span className="text-xs font-medium text-muted-foreground">Book Club</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
          <span className="text-xs font-medium text-muted-foreground">Story Time</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></div>
          <span className="text-xs font-medium text-muted-foreground">Workshop</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded bg-pink-100 border border-pink-200"></div>
          <span className="text-xs font-medium text-muted-foreground">Signing</span>
        </div>
      </div>

      {/* Registration Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <RegistrationModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
