
import React, { useState } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import UserProfile from '@/components/UserProfile';
import FocusTimeBlocks from '@/components/calendar/FocusTimeBlocks';
import { CalendarImportExport } from '@/components/calendar/CalendarImportExport';
import { ChevronLeft, Upload, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Circle, Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Color presets for the color picker
const colorPresets = [
  { name: 'Dark Purple', value: '#1a1625' },
  { name: 'Deep Blue', value: '#1E2746' },
  { name: 'Royal Purple', value: '#6E59A5' },
  { name: 'Indigo', value: '#5B4FC1' },
  { name: 'Ocean Blue', value: '#0EA5E9' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Soft Purple', value: '#8664A0' },
  { name: 'Magenta', value: '#D946EF' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Charcoal', value: '#222222' },
  { name: 'Slate', value: '#334155' },
];

const Settings = () => {
  const { backgroundColor, setBackgroundColor } = useSettingsStore();
  const [activeTab, setActiveTab] = useState('appearance');

  return (
    <div className="container mx-auto p-4 max-w-6xl text-white">
      <div className="flex items-center mb-6">
        <Link to="/">
          <Button variant="ghost" size="icon" className="mr-2 text-white hover:bg-white/10">
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 bg-black/30">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="focus">Focus Time</TabsTrigger>
          <TabsTrigger value="import-export">
            <Upload className="h-4 w-4 mr-2" />
            Import/Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <div className="p-6 bg-black/30 rounded-lg shadow backdrop-blur-sm border border-white/10">
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Background Color</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                {colorPresets.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`relative rounded-full h-10 w-10 flex items-center justify-center p-0 cursor-pointer transition-transform hover:scale-110 ${backgroundColor === color.value ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setBackgroundColor(color.value)}
                    title={color.name}
                  >
                    {backgroundColor === color.value && (
                      <Check className="h-5 w-5 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-3">Custom Color</h3>
              <input
                type="color"
                id="backgroundColor"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="h-10 w-full cursor-pointer rounded"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="p-6 bg-black/30 rounded-lg shadow backdrop-blur-sm border border-white/10">
            <UserProfile />
          </div>
        </TabsContent>

        <TabsContent value="focus">
          <FocusTimeBlocks />
        </TabsContent>

        <TabsContent value="import-export">
          <div className="p-6 bg-black/30 rounded-lg shadow backdrop-blur-sm border border-white/10">
            <CalendarImportExport />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
