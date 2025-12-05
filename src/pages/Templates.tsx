import { TemplateLibrary } from '@/components/templates/TemplateLibrary';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileNavigation from '@/components/MobileNavigation';

export default function Templates() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-4">
      <div className="container mx-auto p-6">
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
          <h1 className="text-2xl font-bold">Event Templates</h1>
        </div>
        <TemplateLibrary />
      </div>
      <MobileNavigation />
    </div>
  );
}
