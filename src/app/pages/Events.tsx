import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, List as ListIcon, MapPin, Clock, ChevronLeft, ChevronRight, Share2, Plus, ArrowRight, X, User, Mail, Phone, Users, Loader2, CheckCircle, BookOpen } from 'lucide-react';
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
                placeholder="(805) 482-1384"
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

// --- Calendar helpers ---

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

// --- Event detail panel shown beside calendar ---

const EventDetailPanel: React.FC<{
  event: typeof EVENTS[0];
  onRegister: () => void;
  onAddToCalendar: () => void;
  onShare: () => void;
  onClose: () => void;
}> = ({ event, onRegister, onAddToCalendar, onShare, onClose }) => {
  const featuredBook = BOOKS.find(b => b.id === event.featuredBookId);

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'Author Reading': return 'bg-purple-500';
      case 'Book Club': return 'bg-blue-500';
      case 'Kids Story Time': return 'bg-green-500';
      case 'Workshop': return 'bg-amber-500';
      case 'Signing': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  const getEventTypeBadge = (type: string) => {
    switch (type) {
      case 'Author Reading': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Book Club': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Kids Story Time': return 'bg-green-50 text-green-700 border-green-200';
      case 'Workshop': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Signing': return 'bg-pink-50 text-pink-700 border-pink-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const eventDate = new Date(event.date + 'T00:00:00');

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-white rounded-2xl border border-border shadow-lg overflow-hidden"
    >
      {/* Colored header bar */}
      <div className={`h-2 ${getEventTypeColor(event.type)}`} />

      <div className="p-6">
        {/* Close button */}
        <div className="flex justify-end mb-2">
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-primary rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Date */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 bg-primary text-white rounded-xl flex flex-col items-center justify-center shrink-0">
            <span className="text-[10px] font-bold uppercase leading-none">
              {eventDate.toLocaleDateString('en-US', { month: 'short' })}
            </span>
            <span className="text-xl font-bold leading-tight">
              {eventDate.getDate()}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-primary">
              {eventDate.toLocaleDateString('en-US', { weekday: 'long' })}
            </p>
            <p className="text-sm text-muted-foreground">{event.time}</p>
          </div>
        </div>

        {/* Title & type */}
        <h3 className="text-xl font-serif font-bold text-primary mb-3">{event.title}</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getEventTypeBadge(event.type)}`}>
            {event.type}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            <MapPin size={11} />
            {event.location}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">{event.description}</p>

        {/* Featured Book */}
        {featuredBook && (
          <div className="bg-muted/40 rounded-xl p-4 mb-6 border border-border/50">
            <div className="flex items-center gap-1.5 mb-3">
              <BookOpen size={13} className="text-muted-foreground" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Featured Book</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-12 aspect-[2/3] shrink-0 rounded shadow-sm overflow-hidden">
                <ImageWithFallback src={featuredBook.cover} alt={featuredBook.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-serif font-bold text-sm text-primary line-clamp-2 leading-tight mb-0.5">{featuredBook.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">{featuredBook.author}</p>
                <Link to={`/book/${featuredBook.id}`} className="text-[10px] font-bold text-accent uppercase flex items-center hover:underline">
                  View Book <ArrowRight size={10} className="ml-1" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={onRegister}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all mb-3"
        >
          Register / RSVP
        </button>
        <div className="flex gap-2">
          <button
            onClick={onAddToCalendar}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-primary py-2.5 rounded-xl border border-border hover:bg-muted/50 transition-all"
          >
            <Plus size={15} />
            Add to Cal
          </button>
          <button
            onClick={onShare}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-primary py-2.5 rounded-xl border border-border hover:bg-muted/50 transition-all"
          >
            <Share2 size={15} />
            Share
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main component ---

export const Events = () => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 1, 1)); // Feb 2026
  const [selectedEvent, setSelectedEvent] = useState<typeof EVENTS[0] | null>(null);
  const [registerEvent, setRegisterEvent] = useState<typeof EVENTS[0] | null>(null);
  const today = new Date();

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

  const getEventDotColor = (type: string) => {
    switch (type) {
      case 'Author Reading': return 'bg-purple-500';
      case 'Book Club': return 'bg-blue-500';
      case 'Kids Story Time': return 'bg-green-500';
      case 'Workshop': return 'bg-amber-500';
      case 'Signing': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  const handleAddToCalendar = (event: typeof EVENTS[0]) => {
    const startDate = new Date(`${event.date}T${event.time.replace(' PM', ':00').replace(' AM', ':00')}`);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${event.title}
DESCRIPTION:${event.description}
LOCATION:Camarillo Bookworm - 93 E Daily Dr, Camarillo, CA 93010
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
    } catch {
      // User cancelled
    }
  };

  // --- Calendar grid calculation ---
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month);
  const daysInPrevMonth = month === 0 ? getDaysInMonth(year - 1, 11) : getDaysInMonth(year, month - 1);

  const calendarCells = useMemo(() => {
    const cells: { day: number; isCurrentMonth: boolean; date: Date }[] = [];

    // Previous month overflow
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cells.push({ day: d, isCurrentMonth: false, date: new Date(prevYear, prevMonth, d) });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
    }

    // Next month overflow to fill remaining rows
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        cells.push({ day: d, isCurrentMonth: false, date: new Date(nextYear, nextMonth, d) });
      }
    }

    return cells;
  }, [year, month, daysInMonth, firstDayOfWeek, daysInPrevMonth]);

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
    setSelectedEvent(null);
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
    setSelectedEvent(null);
  };

  const goToToday = () => {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedEvent(null);
  };

  // Events for the current month
  const eventsThisMonth = EVENTS.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-5xl font-serif font-bold text-primary mb-3">Events</h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Author readings, book clubs, story times, and more at Camarillo Bookworm.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="bg-muted p-1 rounded-lg flex">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              <CalendarIcon size={16} />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
            >
              <ListIcon size={16} />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'calendar' ? (
          <motion.div
            key="calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Calendar + Detail panel layout */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Calendar */}
              <div className={`${selectedEvent ? 'lg:flex-1' : 'w-full'} transition-all`}>
                <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                  {/* Calendar header with navigation */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-serif font-bold text-primary">{monthLabel}</h2>
                      <button
                        onClick={goToToday}
                        className="text-xs font-bold text-accent hover:text-accent/80 px-2.5 py-1 rounded-md border border-accent/30 hover:border-accent/50 transition-all"
                      >
                        Today
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={goToPrevMonth}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={goToNextMonth}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Day of week headers */}
                  <div className="grid grid-cols-7 border-b border-border">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="py-3 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7">
                    {calendarCells.map((cell, i) => {
                      const isToday = isSameDay(cell.date, today);
                      const eventsOnDay = EVENTS.filter(e => {
                        const ed = new Date(e.date + 'T00:00:00');
                        return isSameDay(ed, cell.date);
                      });
                      const hasEvents = eventsOnDay.length > 0 && cell.isCurrentMonth;
                      const isSelectedDay = selectedEvent && cell.isCurrentMonth && eventsOnDay.some(e => e.id === selectedEvent.id);

                      return (
                        <div
                          key={i}
                          className={`
                            min-h-[100px] lg:min-h-[120px] p-2 border-b border-r border-border flex flex-col
                            ${i % 7 === 6 ? 'border-r-0' : ''}
                            ${!cell.isCurrentMonth ? 'bg-muted/5' : ''}
                            ${isSelectedDay ? 'bg-accent/5' : ''}
                            ${hasEvents && !isSelectedDay ? 'hover:bg-muted/20' : ''}
                            transition-colors
                          `}
                        >
                          {/* Day number */}
                          <div className="flex items-center justify-center mb-1.5">
                            <span className={`
                              w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium
                              ${!cell.isCurrentMonth ? 'text-muted-foreground/30' : 'text-primary'}
                              ${isToday ? 'bg-primary text-white font-bold' : ''}
                            `}>
                              {cell.day}
                            </span>
                          </div>

                          {/* Events on this day */}
                          <div className="flex-1 space-y-1">
                            {cell.isCurrentMonth && eventsOnDay.map(event => (
                              <button
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                className={`
                                  w-full text-left px-2 py-1 rounded-md text-[11px] font-semibold leading-tight
                                  cursor-pointer transition-all truncate
                                  ${selectedEvent?.id === event.id
                                    ? 'bg-primary text-white shadow-sm'
                                    : `${getEventTypeBadge(event.type)} hover:shadow-sm`
                                  }
                                `}
                              >
                                <span className="block truncate">{event.time.replace(':00', '')}</span>
                                <span className="block truncate">{event.title}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4 items-center px-2">
                  {[
                    { label: 'Author Reading', color: 'bg-purple-500' },
                    { label: 'Book Club', color: 'bg-blue-500' },
                    { label: 'Story Time', color: 'bg-green-500' },
                    { label: 'Workshop', color: 'bg-amber-500' },
                    { label: 'Signing', color: 'bg-pink-500' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event detail panel */}
              <AnimatePresence>
                {selectedEvent && (
                  <div className="lg:w-[340px] shrink-0">
                    <EventDetailPanel
                      event={selectedEvent}
                      onRegister={() => {
                        setRegisterEvent(selectedEvent);
                      }}
                      onAddToCalendar={() => handleAddToCalendar(selectedEvent)}
                      onShare={() => handleShare(selectedEvent)}
                      onClose={() => setSelectedEvent(null)}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Upcoming events list below calendar */}
            {eventsThisMonth.length > 0 && (
              <div className="mt-10">
                <h3 className="text-lg font-serif font-bold text-primary mb-4">
                  Upcoming This Month
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {eventsThisMonth.map(event => {
                    const eventDate = new Date(event.date + 'T00:00:00');
                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`
                          flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                          ${selectedEvent?.id === event.id
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border bg-white hover:shadow-md hover:border-border/80'
                          }
                        `}
                      >
                        <div className="w-12 h-12 bg-primary text-white rounded-lg flex flex-col items-center justify-center shrink-0">
                          <span className="text-[9px] font-bold uppercase leading-none">
                            {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                          <span className="text-lg font-bold leading-tight">
                            {eventDate.getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-primary truncate">{event.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {eventDate.toLocaleDateString('en-US', { weekday: 'short' })} at {event.time}
                            {' '}&middot;{' '}{event.location}
                          </p>
                        </div>
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getEventDotColor(event.type)}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {EVENTS.map((event) => {
              const featuredBook = BOOKS.find(b => b.id === event.featuredBookId);
              const eventDate = new Date(event.date + 'T00:00:00');
              return (
                <div key={event.id} className="group flex flex-col lg:flex-row gap-6 bg-white p-6 lg:p-8 rounded-2xl border border-border shadow-sm hover:shadow-lg transition-all">
                  {/* Date Block */}
                  <div className="shrink-0 flex flex-col items-center justify-center w-20 h-20 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-2xl font-bold">
                      {eventDate.getDate()}
                    </span>
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getEventTypeBadge(event.type)}`}>
                        {event.type}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-full">
                        <MapPin size={11} />
                        <span>{event.location}</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-full">
                        <Clock size={11} />
                        <span>{event.time}</span>
                      </span>
                    </div>

                    <h2 className="text-2xl font-serif font-bold text-primary group-hover:text-accent transition-colors">{event.title}</h2>
                    <p className="text-muted-foreground leading-relaxed max-w-2xl text-sm">{event.description}</p>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        onClick={() => setRegisterEvent(event)}
                        className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition-all"
                      >
                        Register / RSVP
                      </button>
                      <button
                        onClick={() => handleAddToCalendar(event)}
                        className="flex items-center gap-1.5 text-sm text-primary font-bold hover:underline"
                      >
                        <Plus size={16} />
                        <span>Add to Calendar</span>
                      </button>
                      <button
                        onClick={() => handleShare(event)}
                        className="flex items-center gap-1.5 text-sm text-primary font-bold hover:underline"
                      >
                        <Share2 size={16} />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>

                  {/* Featured Book */}
                  {featuredBook && (
                    <div className="lg:w-56 bg-muted/30 p-4 rounded-xl border border-border/50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Featured Book</p>
                      <div className="flex items-start gap-3">
                        <div className="w-14 aspect-[2/3] shrink-0 rounded shadow-sm overflow-hidden">
                          <ImageWithFallback src={featuredBook.cover} alt={featuredBook.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-serif font-bold text-sm text-primary line-clamp-2 leading-tight mb-0.5">{featuredBook.title}</h4>
                          <p className="text-xs text-muted-foreground mb-2">{featuredBook.author}</p>
                          <Link to={`/book/${featuredBook.id}`} className="text-[10px] font-bold text-accent uppercase flex items-center hover:underline">
                            Shop Book <ArrowRight size={10} className="ml-1" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registration Modal */}
      <AnimatePresence>
        {registerEvent && (
          <RegistrationModal
            event={registerEvent}
            onClose={() => setRegisterEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
