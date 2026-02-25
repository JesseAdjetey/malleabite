import React from "react";

interface GridBackgroundProps {
    children?: React.ReactNode;
    className?: string;
}

export const GridBackground: React.FC<GridBackgroundProps> = ({ children, className }) => {
    return (
        <div className={`min-h-screen w-full relative ${className ?? ''}`}>
            {/* Light mode: white bg with radial dot grid + purple gradient accent */}
            <div
                className="absolute inset-0 z-0 dark:hidden bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"
            />
            <div
                className="absolute inset-0 z-0 dark:hidden bg-[radial-gradient(circle_800px_at_100%_200px,#d5c5ff,transparent)]"
            />

            {/* Dark mode: dark dot matrix */}
            <div
                className="absolute inset-0 z-0 hidden dark:block"
                style={{
                    backgroundColor: '#141420',
                    backgroundImage: `
            radial-gradient(circle at 25% 25%, #2a2a3a 0.5px, transparent 1px),
            radial-gradient(circle at 75% 75%, #1e1e2e 0.5px, transparent 1px)
          `,
                    backgroundSize: '10px 10px',
                    imageRendering: 'pixelated' as React.CSSProperties['imageRendering'],
                }}
            />

            {/* Content */}
            <div className="relative z-10 w-full h-full">
                {children}
            </div>
        </div>
    );
};

export default GridBackground;
