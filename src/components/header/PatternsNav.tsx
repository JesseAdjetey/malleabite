import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Repeat } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PatternsNav = () => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to="/patterns">
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2 hover:bg-purple-500 dark:hover:bg-purple-500 hover:border-purple-500 dark:hover:border-purple-700 transition-colors"
          >
            <Repeat className="h-4 w-4" />
            <span className="hidden md:inline">Patterns</span>
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>Manage recurring patterns</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default PatternsNav;
