
import React from 'react';
import { GripVertical } from 'lucide-react';

const DragHandle: React.FC = () => {
  return (
    <div className="opacity-70 hover:opacity-100">
      <GripVertical size={12} className="text-white/70" />
    </div>
  );
};

export default DragHandle;
