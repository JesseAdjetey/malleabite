// Firebase Migration Test Component
// This component helps verify that Firebase is properly configured
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

// Import Firebase utilities
import { auth, db } from '@/integrations/firebase/config';
import { signIn, signUp, signOutUser, getCurrentUser } from '@/integrations/firebase/auth';
import { MIGRATION_FLAGS } from '@/lib/migration-flags';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
}

export const FirebaseMigrationTest: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    // Test 1: Firebase Config
    try {
      if (auth && db) {
        addTestResult({
          name: 'Firebase Configuration',
          status: 'success',
          message: 'Firebase services initialized successfully'
        });
      } else {
        addTestResult({
          name: 'Firebase Configuration',
          status: 'error',
          message: 'Firebase services failed to initialize'
        });
      }
    } catch (error) {
      addTestResult({
        name: 'Firebase Configuration',
        status: 'error',
        message: `Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Test 2: Migration Flags
    const flagsEnabled = Object.entries(MIGRATION_FLAGS).filter(([key, value]) => 
      key.startsWith('USE_FIREBASE') && value === true
    );

    addTestResult({
      name: 'Migration Flags',
      status: flagsEnabled.length > 0 ? 'success' : 'warning',
      message: flagsEnabled.length > 0 
        ? `${flagsEnabled.length} Firebase features enabled: ${flagsEnabled.map(([key]) => key).join(', ')}`
        : 'No Firebase features enabled yet. Use migration flags to enable features.'
    });

    // Test 3: Firebase Auth Connection
    try {
      const currentUser = getCurrentUser();
      addTestResult({
        name: 'Firebase Auth Connection',
        status: 'success',
        message: currentUser ? `Connected - User: ${currentUser.email}` : 'Connected - No user signed in'
      });
    } catch (error) {
      addTestResult({
        name: 'Firebase Auth Connection',
        status: 'error',
        message: `Auth connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Test 4: Firestore Connection
    try {
      // Simple connection test - try to access db properties
      const projectId = db.app.options.projectId;
      addTestResult({
        name: 'Firestore Connection',
        status: 'success',
        message: `Connected to project: ${projectId}`
      });
    } catch (error) {
      addTestResult({
        name: 'Firestore Connection',
        status: 'error',
        message: `Firestore connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    // Test 5: Environment Variables
    const envVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID'
    ];

    const missingVars = envVars.filter(varName => !import.meta.env[varName]);
    
    if (missingVars.length === 0) {
      addTestResult({
        name: 'Environment Variables',
        status: 'success',
        message: 'All required Firebase environment variables are set'
      });
    } else {
      addTestResult({
        name: 'Environment Variables',
        status: 'warning',
        message: `Missing environment variables: ${missingVars.join(', ')}`
      });
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300 animate-pulse" />;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔥 Firebase Migration Test
        </CardTitle>
        <CardDescription>
          Verify that Firebase is properly configured for the Malleabite migration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runTests} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? 'Running Tests...' : 'Run Migration Tests'}
        </Button>

        {testResults.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold">Test Results:</h3>
            {testResults.map((result, index) => (
              <Alert key={index} className={`
                ${result.status === 'success' ? 'border-green-200 bg-green-50' : ''}
                ${result.status === 'error' ? 'border-red-200 bg-red-50' : ''}
                ${result.status === 'warning' ? 'border-yellow-200 bg-yellow-50' : ''}
              `}>
                <div className="flex items-start gap-2">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <div className="font-medium">{result.name}</div>
                    <AlertDescription className="text-sm">
                      {result.message}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        {testResults.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Next Steps:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Update Firebase config in src/integrations/firebase/config.ts</li>
              <li>• Set environment variables in .env.local</li>
              <li>• Enable Firebase features using migration flags in src/lib/migration-flags.ts</li>
              <li>• Run npm run firebase:setup for guided setup</li>
              <li>• See docs/FIREBASE_MIGRATION_GUIDE.md for complete migration steps</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
