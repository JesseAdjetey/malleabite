
import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';

const AnalyticsNav = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="rounded-full h-9 w-9 cursor-glow gradient-border"
            asChild
          >
            <Link to="/analytics">
              <BarChart3 size={18} />
              <span className="sr-only">Analytics</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Analytics Dashboard</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AnalyticsNav;
