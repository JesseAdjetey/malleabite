
import React from 'react';
import { Folder, RotateCcw, Trash2, Calendar, Clock } from 'lucide-react';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { toast } from 'sonner';

const CalendarFolders: React.FC = () => {
    const { archivedFolders, restoreFolder, deleteArchivedFolder, loading } = useCalendarEvents();

    const handleRestore = async (name: string) => {
        if (window.confirm(`Restore all events from "${name}" to your main calendar?`)) {
            await restoreFolder(name);
        }
    };

    const handleDelete = async (name: string) => {
        if (window.confirm(`Permanently delete all events in "${name}"? This cannot be undone.`)) {
            await deleteArchivedFolder(name);
        }
    };

    if (loading && archivedFolders.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">Loading archives...</div>;
    }

    if (archivedFolders.length === 0) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-white/10 rounded-xl">
                <Folder className="h-12 w-12 text-white/20" />
                <div className="space-y-1">
                    <h3 className="text-lg font-medium text-white/50">No archived calendars</h3>
                    <p className="text-sm text-white/30 max-w-[200px]">
                        Ask Mally to "Archive my current calendar" to start a fresh one.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
                <Folder className="h-5 w-5 text-purple-400" />
                <h2 className="text-xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    Calendar Archives
                </h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {archivedFolders.map((folder) => (
                    <Card key={folder.name} className="bg-white/5 border-white/10 overflow-hidden hover:bg-white/[0.07] transition-colors">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-white text-lg flex items-center gap-2">
                                        <Folder className="h-4 w-4 text-purple-400" />
                                        {folder.name}
                                    </CardTitle>
                                    <CardDescription className="text-white/40 flex items-center gap-2 mt-1">
                                        <Calendar className="h-3 w-3" />
                                        {folder.count} events archived
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pb-2 text-xs text-white/30 flex items-center gap-2">
                            {folder.lastUpdatedAt && (
                                <>
                                    <Clock className="h-3 w-3" />
                                    Last updated: {new Date(folder.lastUpdatedAt).toLocaleDateString()}
                                </>
                            )}
                        </CardContent>
                        <CardFooter className="pt-2 flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 flex-1 hover:cursor-pointer"
                                onClick={() => handleRestore(folder.name)}
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 flex-1"
                                onClick={() => handleDelete(folder.name)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default CalendarFolders;
