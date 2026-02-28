import React, { useState, useEffect, useRef } from 'react';
import '@/styles/ripple-effect.css';

interface RippleBorderProps {
    /** When true, spawns a refraction wave */
    trigger: boolean;
}

interface WaveInstance {
    id: number;
}

let waveCounter = 0;

/**
 * Renders an invisible SVG with displacement map filters (for water refraction),
 * and spawns transparent distortion waves when triggered.
 */
const RippleBorder: React.FC<RippleBorderProps> = ({ trigger }) => {
    const [waves, setWaves] = useState<WaveInstance[]>([]);
    const prevTrigger = useRef(false);

    // Spawn wave on false → true transition
    useEffect(() => {
        if (trigger && !prevTrigger.current) {
            const id = ++waveCounter;
            setWaves(prev => [...prev, { id }]);

            // Auto-remove after animation completes (800ms + buffer)
            const timer = setTimeout(() => {
                setWaves(prev => prev.filter(w => w.id !== id));
            }, 950);

            return () => clearTimeout(timer);
        }
        prevTrigger.current = trigger;
    }, [trigger]);

    return (
        <>
            {/* SVG filters for water-like displacement — hidden, referenced by CSS */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                <defs>
                    {/* Light turbulence — subtle wobble */}
                    <filter id="water-refraction-0" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.015 0.04"
                            numOctaves="3"
                            seed="1"
                            result="turbulence"
                        />
                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="turbulence"
                            scale="6"
                            xChannelSelector="R"
                            yChannelSelector="G"
                        />
                    </filter>

                    {/* Medium turbulence — peak of ripple */}
                    <filter id="water-refraction-1" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.02 0.05"
                            numOctaves="3"
                            seed="2"
                            result="turbulence"
                        />
                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="turbulence"
                            scale="10"
                            xChannelSelector="R"
                            yChannelSelector="G"
                        />
                    </filter>

                    {/* Stronger turbulence — used for the delayed wave layer */}
                    <filter id="water-refraction-2" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.018 0.045"
                            numOctaves="2"
                            seed="3"
                            result="turbulence"
                        />
                        <feDisplacementMap
                            in="SourceGraphic"
                            in2="turbulence"
                            scale="8"
                            xChannelSelector="R"
                            yChannelSelector="G"
                        />
                    </filter>
                </defs>
            </svg>

            {/* Refraction zone overlay */}
            {waves.length > 0 && (
                <div className="refraction-zone">
                    {waves.map(wave => (
                        <React.Fragment key={wave.id}>
                            <div className="refraction-wave" />
                            <div className="refraction-wave refraction-wave-delayed" />
                        </React.Fragment>
                    ))}
                </div>
            )}
        </>
    );
};

export default RippleBorder;
