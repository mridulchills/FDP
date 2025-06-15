
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
      relative overflow-hidden bg-white rounded-3xl border-0 shadow-lg hover:shadow-xl 
      transition-all duration-500 hover:-translate-y-1 group
      ${isVisible ? 'animate-fade-in' : 'opacity-0'}
    `}>
      <CardContent className="p-8">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-4">
            <div className={`
              w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} 
              flex items-center justify-center shadow-lg
              group-hover:scale-110 transition-transform duration-300
            `}>
              <div className="w-7 h-7 text-white">
                {icon}
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                {title}
              </p>
              <div className="flex items-baseline gap-3">
                <p className="text-4xl font-bold text-gray-900 leading-none">
                  {displayValue.toLocaleString()}
                </p>
                {trend && (
                  <span className={`
                    inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold
                    ${trend.isPositive 
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                      : 'text-red-700 bg-red-50 border border-red-200'
                    }
                  `}>
                    <span className="text-sm">{trend.isPositive ? '↗' : '↘'}</span>
                    {Math.abs(trend.value)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Subtle background pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-5 transform translate-x-8 -translate-y-8">
          <div className={`w-full h-full bg-gradient-to-br ${gradient} rounded-full`}></div>
        </div>
      </CardContent>
    </Card>
  );
};
