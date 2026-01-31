import React from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router';
import { 
  User, 
  Heart, 
  History, 
  MapPin, 
  CreditCard, 
  Bell, 
  Settings, 
  LogOut,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '@/app/context/AuthContext';

export const AccountLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Account Overview', path: '/account', icon: User },
    { name: 'My Wishlist', path: '/account/wishlist', icon: Heart },
    { name: 'Order History', path: '/account/orders', icon: History },
    { name: 'Saved Addresses', path: '/account/addresses', icon: MapPin },
    { name: 'Payment Methods', path: '/account/payments', icon: CreditCard },
    { name: 'Notification Preferences', path: '/account/notifications', icon: Bell },
    { name: 'Account Settings', path: '/account/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
        <div className="bg-muted p-4 rounded-full mb-6">
          <BookOpen size={48} className="text-primary opacity-20" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-primary mb-2">Please log in</h2>
        <p className="text-muted-foreground mb-8 text-center max-w-xs">You need to be logged in to view your account details.</p>
        <Link to="/login" className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="p-6 bg-muted/30 border-b border-border">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-bold text-xl">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <div>
                  <h3 className="font-bold text-primary leading-tight">{user.firstName} {user.lastName}</h3>
                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user.email}</p>
                </div>
              </div>
            </div>
            
            <nav className="p-3">
              <ul className="space-y-1">
                {menuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={`flex items-center justify-between p-3 rounded-xl text-sm transition-all group ${
                          isActive 
                            ? 'bg-primary text-white font-bold shadow-md shadow-primary/20' 
                            : 'text-muted-foreground hover:bg-muted hover:text-primary'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <item.icon size={18} className={isActive ? 'text-white' : 'group-hover:text-accent'} />
                          <span>{item.name}</span>
                        </div>
                        {isActive && <ChevronRight size={14} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              
              <div className="mt-4 pt-4 border-t border-border">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 p-3 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            </nav>
          </div>

          <div className="mt-6 p-6 bg-accent/5 rounded-2xl border border-accent/10">
            <div className="flex items-center space-x-2 text-accent mb-2">
              <History size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Community Member</span>
            </div>
            <p className="text-xs text-primary/70 leading-relaxed font-medium">Supporting Camarillo Bookworm since 2024</p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
