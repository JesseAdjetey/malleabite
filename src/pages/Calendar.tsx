
import React from 'react';
import Mainview from '@/components/Mainview';
import { motion } from 'framer-motion';
import { springs } from '@/lib/animations';

const Calendar = () => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={springs.page}
      className="h-screen flex flex-col text-white relative overflow-hidden bg-background"
    >
      <Mainview />
    </motion.div>
  );
};

export default Calendar;
