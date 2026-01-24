
import React from "react";
import ModuleContainer from "./ModuleContainer";
import CalendarFolders from "../calendar/CalendarFolders";
import { Folder } from "lucide-react";
import { useCalendarEvents } from "@/hooks/use-calendar-events";

interface ArchivesModuleProps {
    title: string;
    onRemove?: () => void;
    onTitleChange?: (title: string) => void;
    isMinimized?: boolean;
    onMinimize?: () => void;
    isDragging?: boolean;
}

const ArchivesModule: React.FC<ArchivesModuleProps> = ({
    title,
    onRemove,
    onTitleChange,
    isMinimized,
    onMinimize,
}) => {
    const { archivedFolders } = useCalendarEvents();

    if (isMinimized) {
        return (
            <ModuleContainer
                title={title}
                onRemove={onRemove}
                onTitleChange={onTitleChange}
                isMinimized={isMinimized}
                onMinimize={onMinimize}
            >
                <div className="flex items-center justify-center gap-2 p-2 text-sm text-white/50">
                    <Folder className="h-4 w-4" />
                    <span>{archivedFolders.length} archives</span>
                </div>
            </ModuleContainer>
        );
    }

    return (
        <ModuleContainer
            title={title}
            onRemove={onRemove}
            onTitleChange={onTitleChange}
            isMinimized={isMinimized}
            onMinimize={onMinimize}
        >
            <div className="max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <CalendarFolders />
            </div>
        </ModuleContainer>
    );
};

export default ArchivesModule;
