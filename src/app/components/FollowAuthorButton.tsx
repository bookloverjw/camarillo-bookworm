import React, { useEffect, useState } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@/app/context/AuthContext';
import { followAuthor, listFollows, unfollowAuthor, type AuthorFollow } from '@/lib/notifications';

/** "Follow Louise Erdrich": a heads-up when they have a new book coming. */
export const FollowAuthorButton = ({ author, className = '' }: { author: string; className?: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [follow, setFollow] = useState<AuthorFollow | null>(null);
  const [busy, setBusy] = useState(false);
  const surname = author.split(/,| and | with /i)[0].trim();

  useEffect(() => {
    if (!user) { setFollow(null); return; }
    listFollows(user.id)
      .then(list => setFollow(list.find(f => f.author.toLowerCase() === surname.toLowerCase()) ?? null))
      .catch(() => {});
  }, [user, surname]);

  const toggle = async () => {
    if (!user) {
      toast('Sign in to follow authors', {
        action: { label: 'Sign in', onClick: () => navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`) },
      });
      return;
    }
    setBusy(true);
    try {
      if (follow) { await unfollowAuthor(follow.id); setFollow(null); }
      else {
        const added = await followAuthor(user.id, surname);
        setFollow(added);
        toast.success(`Following ${surname}. We'll tell you about their next book.`);
      }
    } catch (err) {
      toast.error("Couldn't update that.", { description: (err as Error)?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={toggle} disabled={busy} aria-pressed={!!follow}
            className={`inline-flex items-center gap-2 text-sm font-bold transition-colors disabled:opacity-50 ${follow ? 'text-accent' : 'text-primary hover:text-accent'} ${className}`}>
      {busy ? <Loader2 size={18} className="animate-spin" /> : follow ? <UserCheck size={18} /> : <UserPlus size={18} />}
      <span>{follow ? `Following ${surname}` : `Follow ${surname}`}</span>
    </button>
  );
};
