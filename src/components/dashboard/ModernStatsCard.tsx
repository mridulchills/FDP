
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
      shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0
      ${isVisible ? 'animate-fade-in' : 'opacity-0'}
    `}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <div className="flex items-baseline space-x-2">
              <p className="text-3xl font-bold text-gray-900">
                {displayValue.toLocaleString()}
              </p>
              {trend && (
                <span className={`text-sm flex items-center font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
                </span>
              )}
            </div>
          </div>
          <div className={`
            p-4 rounded-full bg-gradient-to-r ${gradient} 
            transform transition-transform duration-200 hover:scale-110
            shadow-lg
          `}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
