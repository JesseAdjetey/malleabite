// Firebase Migration Status Dashboard
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Settings, 
  Database, 
  Lock, 
  Zap,
  Users,
  Calendar,
  CheckSquare,
  Bell,
  Brain
} from 'lucide-react';
import { MIGRATION_FLAGS, shouldUseFirebase } from '@/lib/migration-flags';

interface MigrationFeature {
  key: keyof typeof MIGRATION_FLAGS;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'completed' | 'in-progress' | 'pending';
  enabled: boolean;
}

export const MigrationStatusDashboard: React.FC = () => {
  const [flags, setFlags] = useState(MIGRATION_FLAGS);

  const features: MigrationFeature[] = [
    {
      key: 'USE_FIREBASE_AUTH',
      name: 'Authentication',
      description: 'User sign-in, sign-up, and session management',
      icon: <Lock className="h-5 w-5" />,
      status: 'completed',
      enabled: shouldUseFirebase('USE_FIREBASE_AUTH')
    },
    {
      key: 'USE_FIREBASE_CALENDAR',
      name: 'Calendar Events',
      description: 'Event creation, editing, and real-time updates',
      icon: <Calendar className="h-5 w-5" />,
      status: 'completed',
      enabled: shouldUseFirebase('USE_FIREBASE_CALENDAR')
    },
    {
      key: 'USE_FIREBASE_TODOS',
      name: 'Todo Management',
      description: 'Task creation, completion tracking, and organization',
      icon: <CheckSquare className="h-5 w-5" />,
      status: 'completed',
      enabled: shouldUseFirebase('USE_FIREBASE_TODOS')
    },
    {
      key: 'USE_FIREBASE_EISENHOWER',
      name: 'Eisenhower Matrix',
      description: 'Priority quadrant management and task categorization',
      icon: <Database className="h-5 w-5" />,
      status: 'in-progress',
      enabled: shouldUseFirebase('USE_FIREBASE_EISENHOWER')
    },
    {
      key: 'USE_FIREBASE_REMINDERS',
      name: 'Reminders',
      description: 'Alert scheduling and notification management',
      icon: <Bell className="h-5 w-5" />,
      status: 'in-progress',
      enabled: shouldUseFirebase('USE_FIREBASE_REMINDERS')
    },
    {
      key: 'USE_FIREBASE_AI_FUNCTIONS',
      name: 'AI Functions',
      description: 'Cloud functions for AI scheduling and transcription',
      icon: <Brain className="h-5 w-5" />,
      status: 'completed',
      enabled: shouldUseFirebase('USE_FIREBASE_AI_FUNCTIONS')
    }
  ];

  const completedFeatures = features.filter(f => f.status === 'completed');
  const enabledFeatures = features.filter(f => f.enabled);
  const progressPercentage = (completedFeatures.length / features.length) * 100;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in-progress': return 'text-yellow-600 bg-yellow-100';
      case 'pending': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in-progress': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'pending': return <XCircle className="h-4 w-4 text-gray-600" />;
      default: return <XCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const toggleFeature = (key: keyof typeof MIGRATION_FLAGS) => {
    // Note: This is just for UI demonstration
    // In reality, you'd need to update the actual migration flags file
    console.log(`Toggle ${key}: ${!flags[key]}`);
    alert(`To enable/disable ${key}, update the migration flags in src/lib/migration-flags.ts`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          🔥 Firebase Migration Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track the progress of migrating Malleabite from Supabase to Firebase
        </p>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Migration Progress
          </CardTitle>
          <CardDescription>
            Overall completion status of the Firebase migration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {completedFeatures.length} of {features.length} features completed
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <Progress value={progressPercentage} className="w-full" />
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {completedFeatures.length}
              </div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {enabledFeatures.length}
              </div>
              <div className="text-sm text-gray-500">Enabled</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {features.length - completedFeatures.length}
              </div>
              <div className="text-sm text-gray-500">Remaining</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Feature Migration Status
          </CardTitle>
          <CardDescription>
            Individual feature implementation and enablement status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {features.map((feature) => (
              <div key={feature.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {feature.icon}
                  <div>
                    <div className="font-medium">{feature.name}</div>
                    <div className="text-sm text-gray-500">{feature.description}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge className={getStatusColor(feature.status)}>
                    {getStatusIcon(feature.status)}
                    <span className="ml-1 capitalize">{feature.status}</span>
                  </Badge>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Enabled</span>
                    <Switch 
                      checked={feature.enabled}
                      onCheckedChange={() => toggleFeature(feature.key)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Migration Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
          <CardDescription>
            Recommended actions to complete the migration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Test each feature thoroughly before enabling it in production.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Immediate Actions:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Configure Firebase project settings in config.ts</li>
                <li>Set up environment variables</li>
                <li>Deploy Firebase Cloud Functions</li>
                <li>Set up Firestore security rules</li>
                <li>Test authentication flow</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold">Data Migration:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Export existing Supabase data</li>
                <li>Transform data for Firestore format</li>
                <li>Import data using batch writes</li>
                <li>Verify data integrity</li>
              </ul>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm">
                View Migration Guide
              </Button>
              <Button variant="outline" size="sm">
                Run Tests
              </Button>
              <Button size="sm">
                Deploy Functions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
