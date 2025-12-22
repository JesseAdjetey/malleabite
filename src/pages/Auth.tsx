
import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.unified';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AnimatedLogo from '@/components/auth/AnimatedLogo';
import { Check, ChevronRight, Star, Award, Gift, Trophy, Timer, Calendar, BrainCircuit, Compass, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { authSchema, signUpSchema, sanitizeInput } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { ZodError } from 'zod';

const ACHIEVEMENTS = [
  { id: 'first_visit', title: 'First Visit', icon: Star, description: 'Welcome to Malleabite!' },
  { id: 'explorer', title: 'Explorer', icon: Compass, description: 'Clicked on all interactive elements' },
  { id: 'curious', title: 'Curious Mind', icon: BrainCircuit, description: 'Read about our features' }
];

const Auth = () => {
  const { user, signIn, signUp, signInWithGoogle, loading, error, clearError } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [progress, setProgress] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [featuresExplored, setFeaturesExplored] = useState<Record<string, boolean>>({
    productivity: false,
    timeTracking: false,
    taskManagement: false,
    scheduling: false,
  });
  const [emailSent, setEmailSent] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // References for interactive elements
  const timeOrbsRef = useRef<HTMLDivElement>(null);
  const productivityBoostRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const exploreCountRef = useRef(0);
  
  // Custom cursor effect
  useEffect(() => {
    // Create custom cursor if it doesn't exist
    if (!document.getElementById('custom-cursor')) {
      const cursor = document.createElement('div');
      cursor.id = 'custom-cursor';
      document.body.appendChild(cursor);
      
      const handleMouseMove = (e: MouseEvent) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      
      // Add hover effect listeners
      document.querySelectorAll('.interactive-element').forEach(el => {
        el.addEventListener('mouseenter', () => {
          cursor.classList.add('expanded');
        });
        
        el.addEventListener('mouseleave', () => {
          cursor.classList.remove('expanded');
        });
      });
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (document.body.contains(cursor)) {
          document.body.removeChild(cursor);
        }
      };
    }
  }, []);
  
  // Unlock first visit achievement on load
  useEffect(() => {
    if (!unlockedAchievements.includes('first_visit')) {
      setTimeout(() => {
        unlockAchievement('first_visit');
      }, 2000);
    }
    
    // Setup interactive time orbs
    if (timeOrbsRef.current) {
      createInteractiveTimeOrbs();
    }
    
    // Track progress based on form completion
    updateProgress();
  }, [email, password, name, isSignUp, unlockedAchievements]);
  
  // Create interactive floating time-related orbs
  const createInteractiveTimeOrbs = () => {
    if (!timeOrbsRef.current) return;
    
    const container = timeOrbsRef.current;
    const orbsCount = 5;
    
    // Clear existing orbs
    container.innerHTML = '';
    
    // Add orbs
    for (let i = 0; i < orbsCount; i++) {
      const orb = document.createElement('div');
      const size = Math.random() * 40 + 40;
      const icons = [Timer, Calendar, Check, Star];
      const IconComponent = icons[Math.floor(Math.random() * icons.length)];
      
      orb.className = 'absolute rounded-full flex items-center justify-center draggable interactive-element';
      orb.style.width = `${size}px`;
      orb.style.height = `${size}px`;
      orb.style.top = `${Math.random() * 80 + 10}%`;
      orb.style.left = `${Math.random() * 80 + 10}%`;
      orb.style.background = `rgba(${Math.random() * 100 + 100}, ${Math.random() * 50 + 50}, ${Math.random() * 200 + 50}, 0.3)`;
      orb.style.backdropFilter = 'blur(8px)';
      orb.style.transform = 'translate(-50%, -50%)';
      orb.style.transition = 'transform 0.1s, filter 0.3s';
      orb.style.animation = `float-${i} ${Math.random() * 5 + 10}s infinite alternate ease-in-out`;
      
      // Add icon
      const iconElement = document.createElement('div');
      iconElement.className = 'text-white/70';
      // Use SVG instead of component
      iconElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      orb.appendChild(iconElement);
      
      // Make it draggable
      orb.addEventListener('mousedown', (e: MouseEvent) => {
        const rect = orb.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        
        orb.style.cursor = 'grabbing';
        orb.classList.add('highlight');
        
        // Track element for explorer achievement
        trackElementExplored(i);
        
        const moveHandler = (moveEvent: MouseEvent) => {
          orb.style.left = `${moveEvent.clientX - offsetX}px`;
          orb.style.top = `${moveEvent.clientY - offsetY}px`;
          orb.style.animation = 'none';
        };
        
        const upHandler = () => {
          orb.style.cursor = 'grab';
          orb.classList.remove('highlight');
          
          window.removeEventListener('mousemove', moveHandler);
          window.removeEventListener('mouseup', upHandler);
          
          // Reset to float animation
          setTimeout(() => {
            orb.style.animation = `float-${i} ${Math.random() * 5 + 10}s infinite alternate ease-in-out`;
          }, 100);
        };
        
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
      });
      
      // Create keyframe animation for this specific orb
      const style = document.createElement('style');
      style.textContent = `
        @keyframes float-${i} {
          0% { transform: translate(-50%, -50%) translateX(0) translateY(0); }
          100% { transform: translate(-50%, -50%) translateX(${Math.random() * 100 - 50}px) translateY(${Math.random() * 100 - 50}px); }
        }
      `;
      document.head.appendChild(style);
      
      container.appendChild(orb);
    }
  };
  
  // Track which elements have been explored
  const trackElementExplored = (index: number) => {
    exploreCountRef.current += 1;
    
    // If all interactive elements have been explored
    if (exploreCountRef.current >= 7 && !unlockedAchievements.includes('explorer')) {
      unlockAchievement('explorer');
    }
  };
  
  // Track feature exploration
  const exploreFeature = (feature: string) => {
    if (!featuresExplored[feature]) {
      setFeaturesExplored(prev => ({ ...prev, [feature]: true }));
      
      // Check if all features are explored
      const updatedExplored = { ...featuresExplored, [feature]: true };
      const allExplored = Object.values(updatedExplored).every(Boolean);
      
      if (allExplored && !unlockedAchievements.includes('curious')) {
        unlockAchievement('curious');
      }
    }
  };
  
  // Unlock achievement and show notification
  const unlockAchievement = (id: string) => {
    if (unlockedAchievements.includes(id)) return;
    
    const achievement = ACHIEVEMENTS.find(a => a.id === id);
    if (!achievement) return;
    
    setUnlockedAchievements(prev => [...prev, id]);
    
    // Show achievement notification
    toast({
      title: "Achievement Unlocked!",
      description: achievement.title,
      variant: "default"
    });
    
    // Increment progress
    setProgress(prev => Math.min(prev + 20, 100));
  };
  
  // Update progress bar based on form completion
  const updateProgress = () => {
    let newProgress = 0;
    
    // Email adds 20%
    if (email) newProgress += 20;
    
    // Password adds 20%
    if (password) newProgress += 20;
    
    // Name adds 20% if in signup mode
    if (isSignUp && name) newProgress += 20;
    
    // Achievements add the rest
    newProgress += unlockedAchievements.length * 10;
    
    // Cap at 100%
    newProgress = Math.min(newProgress, 100);
    
    setProgress(newProgress);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationErrors({});
    
    try {
      // Sanitize inputs
      const sanitizedEmail = sanitizeInput(email);
      const sanitizedName = name ? sanitizeInput(name) : undefined;
      
      if (isSignUp) {
        // Validate signup data
        try {
          signUpSchema.parse({
            email: sanitizedEmail,
            password,
            name: sanitizedName
          });
        } catch (validationError) {
          if (validationError instanceof ZodError) {
            const errors: Record<string, string> = {};
            validationError.errors.forEach(err => {
              const path = err.path.join('.');
              errors[path] = err.message;
            });
            setValidationErrors(errors);
            logger.warn('Auth', 'Sign up validation failed', { errors });
            return;
          }
          throw validationError;
        }
        
        const { success, isConfirmationEmailSent } = await signUp(sanitizedEmail, password, sanitizedName);
        
        if (success) {
          // If signup was successful
          if (isConfirmationEmailSent) {
            // Show email confirmation notification
            setEmailSent(true);
            
            // Reset form and switch to sign in
            setTimeout(() => {
              setIsSignUp(false);
              setEmailSent(false);
            }, 500);
          }
        }
      } else {
        // Validate signin data
        try {
          authSchema.parse({
            email: sanitizedEmail,
            password
          });
        } catch (validationError) {
          if (validationError instanceof ZodError) {
            const errors: Record<string, string> = {};
            validationError.errors.forEach(err => {
              const path = err.path.join('.');
              errors[path] = err.message;
            });
            setValidationErrors(errors);
            logger.warn('Auth', 'Sign in validation failed', { errors });
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

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      logger.error('Auth', 'Google sign-in error', err);
    }
  };

  // If user is already logged in, redirect to home page
  if (user) {
    return <Navigate to="/" />;
  }

  return (
    <div 
      ref={mainContainerRef}
      className="min-h-screen flex flex-col relative overflow-x-hidden bg-gradient-to-br from-black via-purple-950/40 to-black text-white"
    >
      {/* Animated background overlay */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_10%_10%,rgba(138,43,226,0.15),transparent_50%)]"></div>
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,rgba(138,43,226,0.1),transparent_50%)]"></div>
        
        {/* Animated grid */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(138, 43, 226, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(138, 43, 226, 0.3) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: '-1px -1px',
            animation: 'gradient-shift 20s ease infinite'
          }}
        ></div>
      </div>
      
      {/* Interactive time orbs */}
      <div ref={timeOrbsRef} className="absolute inset-0 pointer-events-auto z-10"></div>
      
      <div className="container mx-auto px-4 py-4 md:py-6 flex flex-col relative z-20">
        {/* Progress bar */}
        <div className="fixed top-0 left-0 w-full h-1 bg-black/50 z-50">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-violet-500"
            style={{ width: `${progress}%`, transition: 'width 0.5s ease' }}
          ></div>
        </div>
        
        {/* Achievements display - Hidden on mobile for cleaner UI */}
        <div className="fixed top-4 right-4 flex-col gap-2 z-50 hidden md:flex">
          {ACHIEVEMENTS.map(achievement => (
            <div 
              key={achievement.id}
              className={`rounded-full w-10 h-10 flex items-center justify-center transition-all ${
                unlockedAchievements.includes(achievement.id) 
                  ? 'bg-gradient-to-br from-purple-500 to-violet-600 achievement' 
                  : 'bg-gray-800/50 grayscale opacity-50'
              }`}
              title={achievement.title}
            >
              <achievement.icon size={18} />
            </div>
          ))}
        </div>
        
        <div className="flex flex-col xl:flex-row items-center justify-center gap-4 md:gap-6 xl:gap-8 py-4 md:py-6 max-w-6xl mx-auto w-full my-auto">
          {/* Logo and branding */}
          <div className="xl:w-1/2 flex flex-col items-center xl:items-start max-w-lg w-full">
            <div className="mb-3 md:mb-4 interactive-element">
              <AnimatedLogo className="w-32 h-32 md:w-40 md:h-40 xl:w-48 xl:h-48" />
            </div>
            
            <h1 className="text-xl md:text-3xl xl:text-4xl font-bold mb-2 md:mb-3 text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-300 text-center xl:text-left">
              Malleabite
            </h1>
            
            <p className="text-sm md:text-base xl:text-lg mb-3 md:mb-4 text-purple-200/70 max-w-lg text-center xl:text-left">
              Your malleable Integrated Time-management Environment
            </p>
            
            {/* Interactive feature highlights */}
            <div className="grid grid-cols-2 gap-2 md:gap-3 w-full max-w-sm md:max-w-md mb-4">
              <div 
                ref={productivityBoostRef}
                className="glass rounded-xl p-3 md:p-4 flex flex-col items-center text-center hover:scale-105 transition-transform cursor-pointer interactive-element touch-manipulation min-h-[100px]"
                onClick={() => exploreFeature('productivity')}
              >
                <BrainCircuit className="mb-2 text-purple-400" size={24} />
                <h3 className="font-semibold text-white text-xs md:text-sm">Productivity</h3>
                <p className="text-[10px] md:text-xs text-gray-300 mt-1">Optimize workflow</p>
              </div>
              
              <div 
                className="glass rounded-xl p-3 md:p-4 flex flex-col items-center text-center hover:scale-105 transition-transform cursor-pointer interactive-element touch-manipulation min-h-[100px]"
                onClick={() => exploreFeature('timeTracking')}
              >
                <Timer className="mb-2 text-purple-400" size={24} />
                <h3 className="font-semibold text-white text-xs md:text-sm">Time Tracking</h3>
                <p className="text-[10px] md:text-xs text-gray-300 mt-1">Monitor time</p>
              </div>
              
              <div 
                className="glass rounded-xl p-3 md:p-4 flex flex-col items-center text-center hover:scale-105 transition-transform cursor-pointer interactive-element touch-manipulation min-h-[100px]"
                onClick={() => exploreFeature('taskManagement')}
              >
                <Check className="mb-2 text-purple-400" size={24} />
                <h3 className="font-semibold text-white text-xs md:text-sm">Tasks</h3>
                <p className="text-[10px] md:text-xs text-gray-300 mt-1">Never miss deadlines</p>
              </div>
              
              <div 
                className="glass rounded-xl p-3 md:p-4 flex flex-col items-center text-center hover:scale-105 transition-transform cursor-pointer interactive-element touch-manipulation min-h-[100px]"
                onClick={() => exploreFeature('scheduling')}
              >
                <Calendar className="mb-2 text-purple-400" size={24} />
                <h3 className="font-semibold text-white text-xs md:text-sm">Scheduling</h3>
                <p className="text-[10px] md:text-xs text-gray-300 mt-1">Smart calendar</p>
              </div>
            </div>
          </div>
          
          {/* Auth form */}
          <div className="xl:w-1/2 max-w-md w-full">
            <div className="glass p-4 md:p-5 xl:p-6 rounded-2xl border border-purple-500/20 shadow-[0_0_30px_rgba(138,43,226,0.2)]">
              <h2 className="text-base md:text-lg xl:text-xl font-bold mb-3 md:mb-4 text-center">
                {isSignUp ? 'Create Your Account' : 'Welcome Back'}
              </h2>
              
              {emailSent && (
                <div className="bg-green-500/20 border border-green-500/30 text-white p-4 rounded-lg mb-4 flex items-start gap-3">
                  <Mail className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Confirmation email sent!</p>
                    <p className="text-sm opacity-80">Please check your inbox and confirm your email before signing in.</p>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-white p-3 rounded-lg mb-4 flex items-center gap-2">
                  <div className="h-5 w-5 text-red-400 flex-shrink-0">⚠️</div>
                  <p>{error}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        // Clear validation error when user types
                        if (validationErrors.name) {
                          setValidationErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.name;
                            return newErrors;
                          });
                        }
                      }}
                      className={`bg-purple-950/30 border-purple-500/30 text-white ${
                        validationErrors.name ? 'border-red-500' : ''
                      }`}
                      placeholder="John Doe"
                      required={isSignUp}
                    />
                    {validationErrors.name && (
                      <p className="text-red-400 text-sm">{validationErrors.name}</p>
                    )}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      // Clear validation error when user types
                      if (validationErrors.email) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.email;
                          return newErrors;
                        });
                      }
                    }}
                    className={`bg-purple-950/30 border-purple-500/30 text-white ${
                      validationErrors.email ? 'border-red-500' : ''
                    }`}
                    placeholder="your@email.com"
                    required
                  />
                  {validationErrors.email && (
                    <p className="text-red-400 text-sm">{validationErrors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      // Clear validation error when user types
                      if (validationErrors.password) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.password;
                          return newErrors;
                        });
                      }
                    }}
                    className={`bg-purple-950/30 border-purple-500/30 text-white ${
                      validationErrors.password ? 'border-red-500' : ''
                    }`}
                    required
                  />
                  {validationErrors.password && (
                    <p className="text-red-400 text-sm">{validationErrors.password}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full py-4 md:py-5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-medium text-base md:text-lg interactive-button"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
                      <ChevronRight size={18} />
                    </div>
                  )}
                </Button>
              </form>
              
              <div className="relative my-4 md:my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-purple-500/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-purple-950/90 text-gray-400">Or continue with</span>
                </div>
              </div>
              
              <Button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-4 md:py-5 bg-white hover:bg-gray-100 text-gray-900 font-medium text-base md:text-lg border border-gray-300 interactive-button"
                disabled={loading}
              >
                <div className="flex items-center gap-3 justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </div>
              </Button>
              
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-purple-300 hover:text-white transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </div>
            
            {/* Show achievements progress */}
            <div className="mt-6 p-4 glass rounded-xl">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Trophy size={16} className="text-yellow-400" />
                <span>Unlock Achievements</span>
              </h3>
              
              <div className="flex flex-wrap gap-2 text-xs">
                {ACHIEVEMENTS.map(achievement => (
                  <div 
                    key={achievement.id}
                    className={`px-2 py-1 rounded-full flex items-center gap-1 ${
                      unlockedAchievements.includes(achievement.id)
                        ? 'bg-purple-500/30 text-white'
                        : 'bg-gray-800/30 text-gray-400'
                    }`}
                  >
                    <achievement.icon size={12} />
                    <span>{achievement.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
