
import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.unified';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AnimatedLogo from '@/components/auth/AnimatedLogo';
import { Check, ChevronRight, Star, Award, Gift, Trophy, Timer, Calendar, BrainCircuit, Sparkles, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const ACHIEVEMENTS = [
  { id: 'first_visit', title: 'First Visit', icon: Star, description: 'Welcome to Malleabite!' },
  { id: 'explorer', title: 'Explorer', icon: Sparkles, description: 'Clicked on all interactive elements' },
  { id: 'curious', title: 'Curious Mind', icon: BrainCircuit, description: 'Read about our features' }
];

const Auth = () => {
  const { user, signIn, signUp, loading, error, clearError } = useAuth();
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
    
    try {
      if (isSignUp) {
        const { success, isConfirmationEmailSent } = await signUp(email, password, name);
        
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
        await signIn(email, password);
      }
    } catch (err) {
      console.error('Authentication error:', err);
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
  };

  // If user is already logged in, redirect to home page
  if (user) {
    return <Navigate to="/" />;
  }

  return (
    <div 
      ref={mainContainerRef}
      className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-black via-purple-950/40 to-black text-white"
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
      
      <div className="container mx-auto px-4 py-8 flex flex-col min-h-screen relative z-20">
        {/* Progress bar */}
        <div className="fixed top-0 left-0 w-full h-1 bg-black/50 z-50">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-violet-500"
            style={{ width: `${progress}%`, transition: 'width 0.5s ease' }}
          ></div>
        </div>
        
        {/* Achievements display */}
        <div className="fixed top-4 right-4 flex flex-col gap-2 z-50">
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
        
        <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-16 py-8">
          {/* Logo and branding */}
          <div className="md:w-1/2 flex flex-col items-center md:items-start">
            <div className="mb-8 interactive-element">
              <AnimatedLogo className="w-72 h-72" />
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-300">
              Malleabite
            </h1>
            
            <p className="text-xl md:text-2xl mb-8 text-purple-200/70 max-w-lg">
              Your malleable Integrated Time-management Environment
            </p>
            
            {/* Interactive feature highlights */}
            <div className="grid grid-cols-2 gap-4 max-w-lg mb-8">
              <div 
                ref={productivityBoostRef}
                className="glass rounded-xl p-4 flex flex-col items-center text-center hover:scale-105 transition-transform cursor-pointer interactive-element"
                onClick={() => exploreFeature('productivity')}
              >
                <BrainCircuit className="mb-2 text-purple-400" size={28} />
                <h3 className="font-semibold text-white">Productivity Boost</h3>
                <p className="text-sm text-gray-300">Optimize your workflow</p>
              </div>
              
              <div 
                className="glass rounded-xl p-4 flex flex-col items-center text-center hover:scale-105 transition-transform cursor-pointer interactive-element"
                onClick={() => exploreFeature('timeTracking')}
              >
                <Timer className="mb-2 text-purple-400" size={28} />
                <h3 className="font-semibold text-white">Time Tracking</h3>
                <p className="text-sm text-gray-300">Monitor where time goes</p>
              </div>
              
              <div 
                className="glass rounded-xl p-4 flex flex-col items-center text-center hover:scale-105 transition-transform cursor-pointer interactive-element"
                onClick={() => exploreFeature('taskManagement')}
              >
                <Check className="mb-2 text-purple-400" size={28} />
                <h3 className="font-semibold text-white">Task Management</h3>
                <p className="text-sm text-gray-300">Never miss a deadline</p>
              </div>
              
              <div 
                className="glass rounded-xl p-4 flex flex-col items-center text-center hover:scale-105 transition-transform cursor-pointer interactive-element"
                onClick={() => exploreFeature('scheduling')}
              >
                <Calendar className="mb-2 text-purple-400" size={28} />
                <h3 className="font-semibold text-white">Smart Scheduling</h3>
                <p className="text-sm text-gray-300">Automate your calendar</p>
              </div>
            </div>
          </div>
          
          {/* Auth form */}
          <div className="md:w-1/2 max-w-md w-full">
            <div className="glass p-8 rounded-2xl border border-purple-500/20 shadow-[0_0_30px_rgba(138,43,226,0.2)]">
              <h2 className="text-2xl font-bold mb-6 text-center">
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
                      onChange={(e) => setName(e.target.value)}
                      className="bg-purple-950/30 border-purple-500/30 text-white"
                      placeholder="John Doe"
                      required={isSignUp}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-purple-950/30 border-purple-500/30 text-white"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-purple-950/30 border-purple-500/30 text-white"
                    required
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full py-6 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-medium text-lg interactive-button"
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
