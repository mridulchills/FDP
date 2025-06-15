
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ModernStatsCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  delay?: number;
}

export const ModernStatsCard: React.FC<ModernStatsCardProps> = ({
  title,
  value,
  icon,
  gradient,
  trend,
  delay = 0
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      
      // Animate number counting
      const duration = 1500;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      
      const counter = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(counter);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(counter);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <Card className={`
      min-h-[160px] min-w-[280px] shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0
      bg-white/80 backdrop-blur-sm
      ${isVisible ? 'animate-fade-in' : 'opacity-0'}
    `}>
      <CardContent className="p-8">
        <div className="flex items-center justify-between h-full">
          <div className="flex-1 space-y-3">
            <p className="text-base font-semibold text-gray-600 tracking-wide">{title}</p>
            <div className="flex items-baseline space-x-3">
              <p className="text-4xl font-bold text-gray-900 leading-none">
                {displayValue.toLocaleString()}
              </p>
              {trend && (
                <span className={`text-sm flex items-center font-semibold px-2 py-1 rounded-full ${
                  trend.isPositive 
                    ? 'text-emerald-700 bg-emerald-100' 
                    : 'text-red-700 bg-red-100'
                }`}>
                  {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
                </span>
              )}
            </div>
          </div>
          <div className={`
            p-5 rounded-2xl bg-gradient-to-br ${gradient} 
            transform transition-all duration-300 hover:scale-110 hover:rotate-6
            shadow-xl
          `}>
            <div className="w-8 h-8 text-white">
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
