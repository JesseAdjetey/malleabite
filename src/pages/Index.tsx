
import React, { useEffect } from 'react';
import Mainview from '@/components/Mainview';
import { useDateStore, useViewStore } from "@/lib/store";


const Index = () => {


  // Initialize stores on client side
  useEffect(() => {
    // Hydrate zustand stores if needed
    const view = useViewStore.getState();
    const date = useDateStore.getState();

    // Any other initialization needed
  }, []);



  return (
    <div className="min-h-screen flex flex-col text-white relative pb-16 md:pb-0">
      <Mainview />
    </div>
  );
};

export default Index;
