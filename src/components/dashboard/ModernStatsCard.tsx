
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
      w-full h-[160px] shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0
      bg-white/80 backdrop-blur-sm
      ${isVisible ? 'animate-fade-in' : 'opacity-0'}
    `}>
      <CardContent className="p-6 h-full">
        <div className="flex items-center justify-between h-full">
          <div className="flex-1 space-y-3 min-w-0">
            <p className="text-sm font-semibold text-gray-600 tracking-wide truncate">{title}</p>
            <div className="flex items-baseline space-x-2">
              <p className="text-3xl font-bold text-gray-900 leading-none">
                {displayValue.toLocaleString()}
              </p>
              {trend && (
                <span className={`text-xs flex items-center font-semibold px-2 py-1 rounded-full ${
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
            p-4 rounded-2xl bg-gradient-to-br ${gradient} 
            transform transition-all duration-300 hover:scale-110 hover:rotate-6
            shadow-xl flex-shrink-0 ml-4
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
