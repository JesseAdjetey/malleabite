import React from 'react';
import PatternManager from '@/components/patterns/PatternManager';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileNavigation from '@/components/MobileNavigation';

export default function PatternsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-4">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="hover:bg-white/10"
          >
            <Home className="h-5 w-5" />
            <span className="sr-only">Back to Dashboard</span>
          </Button>
          <h1 className="text-2xl font-bold">Recurring Patterns</h1>
        </div>
        <PatternManager />
      </div>
      <MobileNavigation />
    </div>
  );
}
