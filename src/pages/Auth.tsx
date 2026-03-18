import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.unified';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Network, MessageSquare, Feather, ChevronRight, Mail, Moon, Sun, Laptop } from 'lucide-react';
import { authSchema, sanitizeInput } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { ZodError } from 'zod';
import { useThemeStore } from '@/lib/stores/theme-store';
import { GridBackground } from '@/components/ui/grid-background';

const TypewriterText = () => {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'typing_short' | 'waiting' | 'scrambling' | 'typing_long'>('typing_short');

  useEffect(() => {
    const shortText = "Malleabite";
    const longText = "Malleable Integrated Time-management Environment";
    const scrambleChars = "!<>-_\\\\/[]{}—=+*^?#________";
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;

    if (phase === 'typing_short') {
      let index = 0;
      intervalId = setInterval(() => {
        index++;
        setText(shortText.slice(0, index));
        if (index >= shortText.length) {
          clearInterval(intervalId);
          timeoutId = setTimeout(() => setPhase('waiting'), 1500);
        }
      }, 120);
    } else if (phase === 'waiting') {
      timeoutId = setTimeout(() => setPhase('scrambling'), 100);
    } else if (phase === 'scrambling') {
      let iteration = 0;
      intervalId = setInterval(() => {
        setText(longText.split("").map((char, i) => {
          if (i < iteration) return longText[i];
          if (char === ' ') return ' ';
          return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        }).join(""));

        if (iteration >= longText.length) {
          clearInterval(intervalId);
          setText(longText);
          setPhase('typing_long');
        }

        iteration += 0.5; // Controls the speed of decoding
      }, 30);
    } else if (phase === 'typing_long') {
      timeoutId = setTimeout(() => {
        setText('');
        setPhase('typing_short');
      }, 5000); // Loop after 5 seconds
    }

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [phase]);

  return (
    <div className="flex justify-center items-center min-h-[40px] md:min-h-[60px] lg:min-h-[80px]">
      <h1 className="text-xl md:text-2xl lg:text-3xl font-mono font-bold tracking-tight text-foreground text-center flex items-center justify-center flex-wrap">
        {text}
        <span className="animate-pulse ml-1 text-purple-500">_</span>
      </h1>
    </div>
  );
};

const ThemeToggle = () => {
  const { theme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-full transition-all bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center justify-center shadow-sm"
      aria-label="Toggle theme"
      title={`Current: ${theme} - Click to switch`}
    >
      {theme === 'light' && <Sun className="w-4 h-4" />}
      {theme === 'dark' && <Moon className="w-4 h-4" />}
      {theme === 'system' && <Laptop className="w-4 h-4" />}
    </button>
  );
};

const Auth = () => {
  const { user, signIn, signUp, signInWithGoogle, loading, error, clearError } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationErrors({});

    try {
      const sanitizedEmail = sanitizeInput(email);
      const sanitizedName = name ? sanitizeInput(name) : undefined;

      if (isSignUp) {
        try {
          authSchema.parse({ email: sanitizedEmail, password });
          if (sanitizedName && (sanitizedName.length < 2 || sanitizedName.length > 50)) {
            setValidationErrors({ name: 'Name must be between 2 and 50 characters' });
            return;
          }
        } catch (validationError) {
          if (validationError instanceof ZodError) {
            const errors: Record<string, string> = {};
            validationError.errors.forEach(err => {
              const path = err.path.join('.');
              errors[path] = err.message;
            });
            setValidationErrors(errors);
            return;
          }
          throw validationError;
        }

        const { success, isConfirmationEmailSent } = await signUp(sanitizedEmail, password, sanitizedName);

        if (success && isConfirmationEmailSent) {
          setEmailSent(true);
          setTimeout(() => {
            setIsSignUp(false);
            setEmailSent(false);
          }, 3000);
        }
      } else {
        try {
          authSchema.parse({ email: sanitizedEmail, password });
        } catch (validationError) {
          if (validationError instanceof ZodError) {
            const errors: Record<string, string> = {};
            validationError.errors.forEach(err => {
              const path = err.path.join('.');
              errors[path] = err.message;
            });
            setValidationErrors(errors);
            return;
          }
          throw validationError;
        }

        await signIn(sanitizedEmail, password);
      }
    } catch (err) {
      logger.error('Auth', 'Authentication error', err as Error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      logger.error('Auth', 'Google sign-in error', err);
    }
  };

  if (user) {
    return <Navigate to="/" />;
  }

  return (
    <GridBackground className="bg-background text-foreground font-mono overflow-x-hidden selection:bg-purple-500/30">
      <div className="flex flex-col items-center w-full min-h-screen pt-4 pb-12 px-4 md:px-8">

        {/* Top Navbar Pill */}
        <header className="w-full max-w-2xl flex items-center justify-between bg-card/50 backdrop-blur-md border border-border shadow-sm rounded-2xl px-3 py-1.5 md:px-5 md:py-2 z-50">

          {/* Left: Theme Switcher */}
          <div className="flex-1 flex justify-start">
            <ThemeToggle />
          </div>

          {/* Center: Logo */}
          <div className="flex-1 flex justify-center">
            <img src="/logo-quadrant.svg" alt="Malleabite Logo" className="w-11 h-11 md:w-14 md:h-14 transition-transform hover:scale-105" />
          </div>

          {/* Right: Sign in Pill */}
          <div className="flex-1 flex justify-end">
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="h-9 md:h-10 bg-purple-600 hover:bg-purple-700 text-white font-mono text-xs md:text-sm rounded-full transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center gap-2 md:gap-3 px-3 md:px-4 shrink-0 whitespace-nowrap border-none"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5 bg-white rounded-full p-[1px]" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="hidden sm:inline">Sign in</span>
            </Button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="w-full max-w-5xl flex flex-col items-center mt-16 md:mt-24 space-y-16 md:space-y-24">

          {/* Title Section */}
          <div className="w-full px-4 text-center">
            <TypewriterText />
            <p className="mt-6 text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed font-sans">
              Malleabite is a smart calendar and task management application designed to organize your schedule. By connecting your Google Calendar, Malleabite allows you to view, create, and manage your Google Calendar events alongside your local tasks in a single unified interface.
            </p>
          </div>

          {/* Features Spread */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 px-4 lg:px-8">

            <div className="flex flex-col items-center text-center space-y-4 group">
              <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-card transition-colors group-hover:border-purple-500/50">
                <Network className="w-5 h-5 text-foreground group-hover:text-purple-500 transition-colors" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-lg mb-2">Everything in One Place</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">Connect your calendars and to-dos into a single, flowing system.</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center space-y-4 group">
              <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-card transition-colors group-hover:border-purple-500/50">
                <MessageSquare className="w-5 h-5 text-foreground group-hover:text-purple-500 transition-colors" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-lg mb-2">Just Talk to It</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">Add events instantly by using your voice or messaging via WhatsApp.</p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center space-y-4 group">
              <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-card transition-colors group-hover:border-purple-500/50">
                <Feather className="w-5 h-5 text-foreground group-hover:text-purple-500 transition-colors" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-lg mb-2">Simple & Calm</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">A beautiful, minimalist design that adapts to your needs.</p>
              </div>
            </div>

          </div>

          {/* Email Auth Fallback */}
          <div className="w-full max-w-sm flex flex-col items-center pt-8">
            <button
              type="button"
              onClick={() => setShowEmailAuth(!showEmailAuth)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-2"
            >
              <span>{showEmailAuth ? 'Hide email options' : 'Prefer to use email?'}</span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${showEmailAuth ? 'rotate-90' : ''}`} />
            </button>

            <div className={`w-full transition-all duration-300 overflow-hidden ${showEmailAuth ? 'max-h-[600px] opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
              <div className="p-6 bg-card/30 border border-border shadow-sm rounded-2xl backdrop-blur-sm">

                {/* Messages */}
                {error && (
                  <div className="mb-6 p-4 bg-destructive/10 text-destructive text-sm font-medium border-l-2 border-destructive">
                    {error}
                  </div>
                )}
                {emailSent && (
                  <div className="mb-6 p-4 bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium border-l-2 border-green-500 flex items-start gap-3">
                    <Mail className="w-5 h-5 flex-shrink-0" />
                    <span>Confirmation email sent! Please check your inbox.</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (validationErrors.name) setValidationErrors(prev => ({ ...prev, name: '' }));
                        }}
                        className={`h-10 bg-transparent border-border focus-visible:ring-1 focus-visible:ring-purple-500 font-mono text-sm transition-colors ${validationErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        placeholder="Jane Doe"
                        required={isSignUp}
                      />
                      {validationErrors.name && <p className="text-destructive text-xs mt-1">{validationErrors.name}</p>}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (validationErrors.email) setValidationErrors(prev => ({ ...prev, email: '' }));
                      }}
                      className={`h-10 bg-transparent border-border focus-visible:ring-1 focus-visible:ring-purple-500 font-mono text-sm transition-colors ${validationErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      placeholder="jane@example.com"
                      required
                    />
                    {validationErrors.email && <p className="text-destructive text-xs mt-1">{validationErrors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (validationErrors.password) setValidationErrors(prev => ({ ...prev, password: '' }));
                      }}
                      className={`h-10 bg-transparent border-border focus-visible:ring-1 focus-visible:ring-purple-500 font-mono text-sm transition-colors ${validationErrors.password ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      placeholder="••••••••"
                      required
                    />
                    {validationErrors.password && <p className="text-destructive text-xs mt-1">{validationErrors.password}</p>}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 mt-6 bg-muted hover:bg-muted/80 text-foreground font-mono text-xs shadow-sm transition-all flex items-center justify-center"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                    ) : (
                      <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                    )}
                  </Button>
                </form>

                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      clearError();
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors border-b border-transparent hover:border-foreground pb-0.5"
                  >
                    {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </button>
                </div>

              </div>
            </div>
          </div>

        </main>

        {/* Minimal Footer */}
        <footer className="mt-auto pt-16 w-full text-center flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <a href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="/legal/terms" className="hover:text-foreground transition-colors">Terms</a>
        </footer>
      </div>
    </GridBackground>
  );
};

export default Auth;
