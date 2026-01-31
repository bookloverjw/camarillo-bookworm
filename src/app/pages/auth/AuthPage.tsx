import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, Lock, Eye, EyeOff, ChevronRight, CheckCircle2, ArrowLeft, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';

type AuthMethod = 'email' | 'phone';
type AuthStep = 'form' | 'verify' | 'forgot-password' | 'reset-sent';

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [method, setMethod] = useState<AuthMethod>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<AuthStep>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // OTP verification
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendTimer, setResendTimer] = useState(0);

  const {
    signUpWithEmail,
    signInWithEmail,
    signInWithPhone,
    verifyPhoneOtp,
    resetPassword,
    user
  } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const redirect = searchParams.get('redirect') || '/account';
      navigate(redirect);
    }
  }, [user, navigate, searchParams]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  // Get phone in E.164 format for Supabase
  const getE164Phone = () => {
    const digits = phone.replace(/\D/g, '');
    return `+1${digits}`;
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newOtp = [...otp];
      digits.split('').forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpInputs.current[nextIndex]?.focus();
    } else {
      const newOtp = [...otp];
      newOtp[index] = value.replace(/\D/g, '');
      setOtp(newOtp);
      if (value && index < 5) {
        otpInputs.current[index + 1]?.focus();
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  // Submit auth form
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (isLogin) {
        // Login
        if (method === 'email') {
          const { error } = await signInWithEmail(email, password);
          if (error) {
            setError(error.message);
          } else {
            toast.success('Welcome back!');
            navigate('/account');
          }
        } else {
          // Phone login - send OTP
          const { error } = await signInWithPhone(getE164Phone());
          if (error) {
            setError(error.message);
          } else {
            setStep('verify');
            setResendTimer(60);
            toast.success('Verification code sent!');
          }
        }
      } else {
        // Sign up
        if (method === 'email') {
          const { error } = await signUpWithEmail(email, password, firstName, lastName, marketingOptIn);
          if (error) {
            setError(error.message);
          } else {
            setStep('verify');
            toast.success('Account created! Please check your email to verify.');
          }
        } else {
          // Phone signup - send OTP first
          const { error } = await signInWithPhone(getE164Phone());
          if (error) {
            setError(error.message);
          } else {
            setStep('verify');
            setResendTimer(60);
            toast.success('Verification code sent!');
          }
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify OTP
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (method === 'phone') {
        const { error } = await verifyPhoneOtp(getE164Phone(), otpCode);
        if (error) {
          setError(error.message);
        } else {
          toast.success('Phone verified successfully!');
          navigate('/account');
        }
      } else {
        // For email, the verification happens via the email link
        // This step is just informational for email
        toast.info('Please check your email and click the verification link.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { error } = await resetPassword(email);
      if (error) {
        setError(error.message);
      } else {
        setStep('reset-sent');
        toast.success('Password reset email sent!');
      }
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    if (resendTimer > 0) return;

    setIsSubmitting(true);
    try {
      if (method === 'phone') {
        const { error } = await signInWithPhone(getE164Phone());
        if (error) {
          setError(error.message);
        } else {
          setResendTimer(60);
          toast.success('New code sent!');
        }
      }
    } catch (err) {
      setError('Failed to resend code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-muted rounded-full mb-6">
            <BookOpen size={40} className="text-primary" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-primary mb-2">
            {step === 'verify' && 'Verification'}
            {step === 'forgot-password' && 'Reset Password'}
            {step === 'reset-sent' && 'Check Your Email'}
            {step === 'form' && (isLogin ? 'Welcome Back' : 'Join the Community')}
          </h1>
          <p className="text-muted-foreground">
            {step === 'verify' && `We've sent a code to your ${method}`}
            {step === 'forgot-password' && 'Enter your email to receive a reset link'}
            {step === 'reset-sent' && 'Follow the link in your email to reset your password'}
            {step === 'form' && (isLogin ? 'Sign in to access your library' : 'Create an account to start your collection')}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-border p-8 shadow-xl relative overflow-hidden">
          {/* Progress bar for verification step */}
          {step === 'verify' && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '50%' }}
                className="h-full bg-accent"
              />
            </div>
          )}

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3"
              >
                <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* Main Auth Form */}
            {step === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {/* Method Switcher (for signup) */}
                {!isLogin && (
                  <div className="flex bg-muted p-1 rounded-xl mb-8">
                    <button
                      type="button"
                      onClick={() => setMethod('email')}
                      className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-sm font-bold transition-all ${method === 'email' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
                    >
                      <Mail size={16} />
                      <span>Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMethod('phone')}
                      className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-sm font-bold transition-all ${method === 'phone' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
                    >
                      <Phone size={16} />
                      <span>Phone</span>
                    </button>
                  </div>
                )}

                <form onSubmit={handleAuth} className="space-y-6">
                  {/* Name fields (signup only) */}
                  {!isLogin && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none text-sm"
                          placeholder="Jane"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
                        <input
                          type="text"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full px-4 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none text-sm"
                          placeholder="Bookworm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Email or Phone input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {method === 'email' ? 'Email Address' : 'Phone Number'}
                    </label>
                    <div className="relative">
                      {method === 'email' ? (
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      ) : (
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      )}
                      <input
                        type={method === 'email' ? 'email' : 'tel'}
                        value={method === 'email' ? email : phone}
                        onChange={method === 'email' ? (e) => setEmail(e.target.value) : handlePhoneChange}
                        required
                        className="w-full pl-12 pr-4 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none text-sm"
                        placeholder={method === 'email' ? 'jane@example.com' : '(805) 555-0123'}
                      />
                    </div>
                  </div>

                  {/* Password field (email method only) */}
                  {method === 'email' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                        {isLogin && (
                          <button
                            type="button"
                            onClick={() => setStep('forgot-password')}
                            className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline"
                          >
                            Forgot?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full pl-12 pr-12 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none text-sm"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {!isLogin && (
                        <p className="text-[10px] text-muted-foreground mt-1">Must be at least 8 characters</p>
                      )}
                    </div>
                  )}

                  {/* Signup checkboxes */}
                  {!isLogin && (
                    <div className="space-y-4 pt-2">
                      <label className="flex items-start space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={marketingOptIn}
                          onChange={(e) => setMarketingOptIn(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent"
                        />
                        <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors leading-relaxed">
                          I'd like to receive news about events and special promotions.
                        </span>
                      </label>
                      <label className="flex items-start space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          required
                          className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent"
                        />
                        <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors leading-relaxed">
                          I agree to the <Link to="/terms" className="underline">Terms of Service</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
                        </span>
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <span>{isLogin ? (method === 'phone' ? 'Send Code' : 'Sign In') : 'Create Account'}</span>
                        <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-10 pt-8 border-t border-border">
                  <p className="text-sm text-center text-muted-foreground">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}
                    <button
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setError(null);
                      }}
                      className="ml-2 font-bold text-accent hover:underline"
                    >
                      {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Verification Step */}
            {step === 'verify' && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <button
                  onClick={() => {
                    setStep('form');
                    setOtp(['', '', '', '', '', '']);
                    setError(null);
                  }}
                  className="flex items-center space-x-2 text-xs font-bold text-muted-foreground hover:text-primary mb-2 transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Back to details</span>
                </button>

                {method === 'email' ? (
                  // Email verification message
                  <div className="text-center space-y-6">
                    <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                      <Mail size={32} className="text-accent" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        We've sent a verification link to:
                      </p>
                      <p className="font-bold text-primary">{email}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Click the link in the email to verify your account and start shopping.
                    </p>
                    <button
                      onClick={() => navigate('/shop')}
                      className="w-full bg-accent text-white py-4 rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 active:scale-[0.98] transition-all"
                    >
                      Continue to Shop
                    </button>
                  </div>
                ) : (
                  // Phone OTP input
                  <form onSubmit={handleVerify} className="space-y-6">
                    <div className="flex justify-center space-x-3">
                      {otp.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => (otpInputs.current[i] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={digit}
                          onChange={(e) => handleOtpChange(i, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(i, e)}
                          className="w-10 h-14 bg-muted/30 border border-border rounded-xl text-center text-xl font-bold text-primary focus:ring-2 focus:ring-accent focus:border-accent outline-none"
                          autoFocus={i === 0}
                        />
                      ))}
                    </div>

                    <p className="text-center text-sm text-muted-foreground">
                      Didn't receive the code?{' '}
                      <button
                        type="button"
                        onClick={handleResendCode}
                        disabled={resendTimer > 0 || isSubmitting}
                        className="font-bold text-accent hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resendTimer > 0 ? `Resend in 0:${resendTimer.toString().padStart(2, '0')}` : 'Resend'}
                      </button>
                    </p>

                    <button
                      type="submit"
                      disabled={isSubmitting || otp.join('').length !== 6}
                      className="w-full bg-accent text-white py-4 rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          <span>Verify & Continue</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </motion.div>
            )}

            {/* Forgot Password Step */}
            {step === 'forgot-password' && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button
                  onClick={() => {
                    setStep('form');
                    setError(null);
                  }}
                  className="flex items-center space-x-2 text-xs font-bold text-muted-foreground hover:text-primary mb-6 transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Back to login</span>
                </button>

                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-3 bg-muted/30 border border-border rounded-xl focus:ring-1 focus:ring-accent outline-none text-sm"
                        placeholder="jane@example.com"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <span>Send Reset Link</span>
                        <ChevronRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* Reset Email Sent */}
            {step === 'reset-sent' && (
              <motion.div
                key="reset-sent"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-6"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    We've sent a password reset link to:
                  </p>
                  <p className="font-bold text-primary">{email}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Check your inbox and click the link to create a new password.
                </p>
                <button
                  onClick={() => {
                    setStep('form');
                    setIsLogin(true);
                  }}
                  className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  Back to Login
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
