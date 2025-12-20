
import React, { useEffect, useRef } from 'react';

interface AnimatedLogoProps {
  className?: string;
}

const AnimatedLogo: React.FC<AnimatedLogoProps> = ({ className }) => {
  const logoRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const logoElement = logoRef.current;
    const container = containerRef.current;
    if (!logoElement || !container) return;

    // Add glow animation
    const addGlow = () => {
      const glowElement = document.createElement('div');
      glowElement.className = 'absolute inset-0 z-0 opacity-0';
      glowElement.style.background = 'radial-gradient(circle, rgba(138, 43, 226, 0.6) 0%, rgba(25, 15, 45, 0) 70%)';
      glowElement.style.animation = 'glow 3s ease-in-out infinite alternate';
      glowElement.style.filter = 'blur(20px)';
      container.appendChild(glowElement);
    };
    
    addGlow();

    const handleMouseMove = (e: MouseEvent) => {
      const { left, top, width, height } = container.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      
      // Calculate distance from center (normalized)
      const distX = (e.clientX - centerX) / (window.innerWidth / 3);
      const distY = (e.clientY - centerY) / (window.innerHeight / 3);
      
      // Apply more dramatic 3D rotation effect
      logoElement.style.transform = `
        perspective(1000px) 
        rotateY(${distX * 15}deg) 
        rotateX(${-distY * 15}deg)
        scale3d(1.05, 1.05, 1.05)
      `;
      
      // Change shadow based on angle
      logoElement.style.filter = `
        drop-shadow(${-distX * 15}px ${-distY * 15}px 15px rgba(138, 43, 226, 0.3))
      `;
    };

    const resetPosition = () => {
      logoElement.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)';
      logoElement.style.filter = 'drop-shadow(0 0 10px rgba(138, 43, 226, 0.2))';
    };

    window.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', resetPosition);

    // Add floating animation
    logoElement.style.animation = 'floatLogo 6s ease-in-out infinite';

    // Add clickable interaction
    container.addEventListener('click', (event: MouseEvent) => {
      // Play a quick pulse animation on click
      logoElement.style.animation = 'none';
      setTimeout(() => {
        logoElement.style.animation = 'pulse-interactive 0.5s ease-out forwards, floatLogo 6s ease-in-out infinite 0.5s';
      }, 10);
      
      // Generate sparkles/particles on click
      for (let i = 0; i < 20; i++) {
        createParticle(container, event.clientX, event.clientY);
      }
    });

    // Function to create particles
    const createParticle = (parent: HTMLElement, x: number, y: number) => {
      const particle = document.createElement('div');
      const size = Math.random() * 10 + 5;
      const rect = parent.getBoundingClientRect();
      const localX = x - rect.left;
      const localY = y - rect.top;
      
      particle.className = 'absolute rounded-full bg-primary/60 z-20';
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${localX}px`;
      particle.style.top = `${localY}px`;
      
      // Random direction
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 100 + 50;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      // Add animation
      particle.style.animation = 'fadeOut 0.8s forwards';
      
      parent.appendChild(particle);
      
      // Animate particle
      let startTime = performance.now();
      const animateParticle = (time: number) => {
        const elapsed = time - startTime;
        const progress = elapsed / 800; // 800ms duration
        
        if (progress >= 1) {
          parent.removeChild(particle);
          return;
        }
        
        const currentX = localX + vx * progress;
        const currentY = localY + vy * progress - (300 * progress * progress); // Arc upward
        
        particle.style.left = `${currentX}px`;
        particle.style.top = `${currentY}px`;
        particle.style.opacity = `${1 - progress}`;
        
        requestAnimationFrame(animateParticle);
      };
      
      requestAnimationFrame(animateParticle);
    };

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', resetPosition);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div 
        ref={logoRef} 
        className="transition-all duration-200 ease-out z-10 relative"
      >
        <img 
          src="/assets/logo.png" 
          alt="Malleabite Logo" 
          className="w-full h-full object-contain"
        />
      </div>
      
      {/* Add animated orbs around the logo */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div 
          key={i}
          className="absolute rounded-full bg-primary/10 blur-xl z-0"
          style={{
            width: `${Math.random() * 100 + 50}px`,
            height: `${Math.random() * 100 + 50}px`,
            top: `${Math.random() * 200 - 50}%`,
            left: `${Math.random() * 200 - 50}%`,
            animation: `orbit ${Math.random() * 15 + 20}s linear infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  );
};

export default AnimatedLogo;
