import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.unified';
import { useCalendarEvents } from '@/hooks/use-calendar-events.unified';
import { useSubscription } from '@/hooks/use-subscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  Plus, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Zap,
  BarChart3,
  Bot,
  ArrowRight,
  Target,
  Activity,
  LogOut,
  Crown,
  CreditCard
} from 'lucide-react';
import dayjs from 'dayjs';
import MobileNavigation from '@/components/MobileNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { events } = useCalendarEvents();
  const { subscription, plan, loading: subscriptionLoading } = useSubscription();
  const isMobile = useIsMobile();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = dayjs().hour();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Calculate stats
  const today = dayjs().format('YYYY-MM-DD');
  const todayEvents = events.filter((event: any) => event.date === today);
  const upcomingEvents = events
    .filter((event: any) => dayjs(event.date).isAfter(dayjs(), 'day'))
    .sort((a: any, b: any) => dayjs(a.date).diff(dayjs(b.date)))
    .slice(0, 5);
  
  const thisWeekEvents = events.filter((event: any) => {
    const eventDate = dayjs(event.date);
    return eventDate.isAfter(dayjs().subtract(1, 'day')) && eventDate.isBefore(dayjs().add(7, 'day'));
  });

  const completedEvents = events.filter((event: any) => 
    dayjs(event.date).isBefore(dayjs(), 'day')
  ).length;

  // Subscription info
  const isPro = subscription?.isPro ?? false;
  const planName = isPro ? 'Pro' : 'Free';
  const eventsLimitRaw = plan?.limits?.eventsPerMonth ?? 50;
  const aiLimitRaw = plan?.limits?.aiRequestsPerMonth ?? 10;
  const eventsLimit: number = eventsLimitRaw;
  const aiLimit: number = aiLimitRaw;
  const eventsUsed = events.length;
  const aiUsed = 0; // TODO: Track AI usage
  const eventsPercentage = eventsLimit === -1 ? 0 : Math.min((eventsUsed / eventsLimit) * 100, 100);
  const aiPercentage = aiLimit === -1 ? 0 : Math.min((aiUsed / aiLimit) * 100, 100);

  const quickActions = [
    {
      icon: Plus,
      label: 'Create Event',
      description: 'Schedule new activity',
      color: 'from-slate-600 to-slate-700',
      action: () => navigate('/calendar')
    },
    {
      icon: Bot,
      label: 'AI Schedule',
      description: 'Let Mally help',
      color: 'from-indigo-600 to-indigo-700',
      action: () => navigate('/calendar') // Will open MallyAI
    },
    {
      icon: BarChart3,
      label: 'View Analytics',
      description: 'Check your progress',
      color: 'from-violet-600 to-violet-700',
      action: () => navigate('/analytics')
    },
    {
      icon: Zap,
      label: 'Quick Schedule',
      description: 'Fast event creation',
      color: 'from-purple-600 to-purple-700',
      action: () => navigate('/quick-schedule')
    }
  ];

  const stats = [
    { 
      label: 'Today\'s Events', 
      value: todayEvents.length, 
      icon: Calendar, 
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10'
    },
    { 
      label: 'This Week', 
      value: thisWeekEvents.length, 
      icon: Clock, 
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10'
    },
    { 
      label: 'Completed', 
      value: completedEvents, 
      icon: CheckCircle2, 
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10'
    },
    { 
      label: 'Total Events', 
      value: events.length, 
      icon: Activity, 
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/10'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-4">
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 border-b border-white/5"
      >
        {/* Gradient background effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-background to-violet-900/20 backdrop-blur-xl" />
        
        <div className="container mx-auto px-4 py-4 md:py-5 relative">
          {/* Single row layout */}
          <div className="flex items-center justify-between">
            {/* Left: Logo + Greeting */}
            <div className="flex items-center gap-4 md:gap-6">
              {/* Animated Logo Container */}
              <motion.div 
                className="relative group cursor-pointer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/dashboard')}
              >
                <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-violet-600 rounded-2xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity" />
                <div className="relative bg-gray-900/80 p-2 rounded-xl border border-purple-500/30">
                  <img 
                    src="/lovable-uploads/43ff48d8-817a-40cc-ae01-ccfeb52283cd.png" 
                    alt="Malleabite" 
                    className="h-8 w-8 md:h-9 md:w-9"
                  />
                </div>
              </motion.div>
              
              {/* Greeting & Date */}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg md:text-2xl font-bold text-foreground">
                    {greeting}, <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent">{user?.displayName?.split(' ')[0] || 'there'}</span>
                  </h1>
                  <motion.div
                    animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
                    className="text-xl md:text-2xl"
                  >
                    👋
                  </motion.div>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {dayjs().format('dddd, MMMM D')} • <span className="text-purple-400">{todayEvents.length} events today</span>
                </p>
              </div>
            </div>
            
            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Upgrade Button - Show for free users */}
              {!isPro && !subscriptionLoading && (
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => navigate('/pricing')}
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white rounded-xl"
                  >
                    <Crown className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Upgrade</span>
                  </Button>
                </motion.div>
              )}
              
              {/* Pro Badge */}
              {isPro && (
                <Badge className="bg-purple-600 text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  PRO
                </Badge>
              )}
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => navigate('/settings')}
                  variant="ghost"
                  size="icon"
                  className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  <Target className="h-4 w-4 text-muted-foreground" />
                </Button>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={signOut}
                  variant="ghost"
                  size="icon"
                  className="rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
                >
                  <LogOut className="h-4 w-4 text-red-400" />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.header>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container mx-auto px-4 py-6 space-y-6"
      >
        {/* Stats Grid */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="glass-card hover:shadow-lg hover:shadow-purple-500/20 transition-all">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 md:p-3 ${stat.bgColor}`}>
                      <stat.icon className={`h-5 w-5 md:h-6 md:w-6 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl md:text-3xl font-bold">{stat.value}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Subscription Status & Usage Banner */}
        <motion.div variants={itemVariants}>
          <Card className={`glass-card border ${isPro ? 'border-purple-500/50 bg-gradient-to-r from-purple-900/20 to-violet-900/20' : 'border-amber-500/30 bg-gradient-to-r from-amber-900/10 to-orange-900/10'}`}>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Plan Status */}
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-3 ${isPro ? 'bg-purple-500/20' : 'bg-amber-500/20'}`}>
                    {isPro ? (
                      <Crown className="h-6 w-6 text-purple-400" />
                    ) : (
                      <Zap className="h-6 w-6 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{planName} Plan</h3>
                      <Badge variant={isPro ? 'default' : 'secondary'} className={isPro ? 'bg-purple-600' : ''}>
                        {isPro ? 'Active' : 'Limited'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isPro ? 'Unlimited access to all features' : 'Upgrade to unlock unlimited events & AI'}
                    </p>
                  </div>
                </div>

                {/* Usage Stats - Only show for Free users */}
                {!isPro && (
                  <div className="flex-1 max-w-md space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Events</span>
                        <span className={eventsPercentage > 80 ? 'text-amber-400' : 'text-foreground'}>
                          {eventsUsed} / {eventsLimit}
                        </span>
                      </div>
                      <Progress value={eventsPercentage} className={`h-2 ${eventsPercentage > 80 ? '[&>div]:bg-amber-500' : ''}`} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">AI Requests</span>
                        <span className={aiPercentage > 80 ? 'text-amber-400' : 'text-foreground'}>
                          {aiUsed} / {aiLimit}
                        </span>
                      </div>
                      <Progress value={aiPercentage} className={`h-2 ${aiPercentage > 80 ? '[&>div]:bg-amber-500' : ''}`} />
                    </div>
                  </div>
                )}

                {/* CTA Buttons */}
                <div className="flex gap-2">
                  {!isPro && (
                    <Button
                      onClick={() => navigate('/pricing')}
                      className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      Upgrade to Pro
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => navigate('/billing')}
                    className="border-white/20"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isPro ? 'Manage Billing' : 'View Plans'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <h2 className="text-xl md:text-2xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 md:h-6 md:w-6 text-purple-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {quickActions.map((action) => (
              <Card
                key={action.label}
                className="glass-card hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20 transition-all cursor-pointer group"
                onClick={action.action}
              >
                <CardContent className="p-4 md:p-6">
                  <div className={`rounded-xl p-3 md:p-4 bg-gradient-to-br ${action.color} mb-3`}>
                    <action.icon className="h-6 w-6 md:h-8 md:w-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm md:text-base mb-1">{action.label}</h3>
                  <p className="text-xs text-muted-foreground hidden md:block">{action.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Today's Schedule */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-400" />
                  Today's Schedule
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/calendar')}
                  className="text-purple-400 hover:text-purple-300"
                >
                  View Calendar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No events scheduled for today</p>
                  <Button
                    onClick={() => navigate('/calendar')}
                    className="mt-4"
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Event
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer"
                      onClick={() => navigate('/calendar')}
                    >
                      <div className={`h-10 w-1 rounded-full ${event.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.startsAt} - {event.endsAt}
                        </p>
                      </div>
                      {event.hasAlarm && (
                        <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                  {todayEvents.length > 5 && (
                    <p className="text-sm text-center text-muted-foreground pt-2">
                      +{todayEvents.length - 5} more events
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div variants={itemVariants}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                Upcoming Events
              </CardTitle>
              <CardDescription>Next 5 scheduled events</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">All caught up! No upcoming events.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer"
                      onClick={() => navigate('/calendar')}
                    >
                      <div className={`h-10 w-1 rounded-full ${event.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {dayjs(event.date).format('MMM D')} at {event.startsAt}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <MobileNavigation />
    </div>
  );
};

export default Dashboard;
