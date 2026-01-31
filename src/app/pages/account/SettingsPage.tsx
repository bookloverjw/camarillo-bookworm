import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Lock, Mail, Phone, Trash2, ShieldCheck, Bell } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

export const SettingsPage = () => {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div className="space-y-10 pb-20">
      <div>
        <h2 className="text-3xl font-serif font-bold text-primary mb-2">Account Settings</h2>
        <p className="text-muted-foreground">Manage your profile and security preferences.</p>
      </div>

      {/* Profile Section */}
      <section className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border flex items-center space-x-3">
          <User size={20} className="text-accent" />
          <h3 className="font-bold text-primary">Personal Profile</h3>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
              <input 
                type="text" 
                defaultValue={user?.firstName}
                className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
              <input 
                type="text" 
                defaultValue={user?.lastName}
                className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none" 
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address</label>
            <div className="flex space-x-3">
              <input 
                type="email" 
                defaultValue={user?.email}
                className="flex-1 px-4 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none" 
              />
              <button className="px-4 py-3 border border-border rounded-xl text-xs font-bold hover:bg-muted transition-colors">Change</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone Number</label>
            <input 
              type="tel" 
              defaultValue={user?.phone}
              className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none" 
            />
          </div>
          <div className="pt-4 flex justify-end">
            <button className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/10">
              Save Changes
            </button>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border flex items-center space-x-3">
          <ShieldCheck size={20} className="text-accent" />
          <h3 className="font-bold text-primary">Security</h3>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-border/50">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-white rounded-lg border border-border shadow-sm">
                <Lock size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary">Password</p>
                <p className="text-xs text-muted-foreground">Last changed 4 months ago</p>
              </div>
            </div>
            <button className="text-xs font-bold text-accent hover:underline">Update Password</button>
          </div>
          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-border/50">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-white rounded-lg border border-border shadow-sm">
                <ShieldCheck size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Secure your account with SMS codes</p>
              </div>
            </div>
            <div className="w-12 h-6 bg-muted rounded-full relative cursor-pointer border border-border">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-red-50/30 rounded-2xl border border-red-100 overflow-hidden">
        <div className="p-6 border-b border-red-100 flex items-center space-x-3">
          <Trash2 size={20} className="text-red-500" />
          <h3 className="font-bold text-red-700">Danger Zone</h3>
        </div>
        <div className="p-8">
          <p className="text-sm text-red-600/70 mb-6 leading-relaxed">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button 
            onClick={() => setIsDeleting(true)}
            className="flex items-center space-x-2 text-sm font-bold text-red-600 border border-red-200 bg-white px-6 py-3 rounded-xl hover:bg-red-50 transition-all"
          >
            <Trash2 size={16} />
            <span>Delete Account</span>
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDeleting(false)}></div>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl"
          >
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-serif font-bold text-primary text-center mb-2">Are you sure?</h3>
            <p className="text-muted-foreground text-center mb-8">
              This will permanently delete your library history, wishlist, and all saved data.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setIsDeleting(false)}
                className="py-4 border border-border rounded-xl font-bold text-primary hover:bg-muted"
              >
                Cancel
              </button>
              <button className="py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">
                Yes, Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
