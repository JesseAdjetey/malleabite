import { Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function QuickScheduleNav() {
  const navigate = useNavigate();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/quick-schedule')}
          className="light-mode:hover:bg-gray-200 dark-mode:hover:bg-white/10"
        >
          <Zap className="h-5 w-5 text-yellow-500" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Quick Schedule</p>
      </TooltipContent>
    </Tooltip>
  );
}
