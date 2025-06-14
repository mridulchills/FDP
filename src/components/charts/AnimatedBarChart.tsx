
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartData } from '@/types';

interface AnimatedBarChartProps {
  data: ChartData[];
  title: string;
  height?: number;
  color?: string;
}

export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  data,
  title,
  height = 300,
  color = '#2C2E83'
}) => {
  const [animatedData, setAnimatedData] = useState<ChartData[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    // Start with zero values
    const zeroData = data.map(item => ({ ...item, value: 0 }));
    setAnimatedData(zeroData);
    
    // Animate to actual values
    const timer = setTimeout(() => {
      setAnimatedData(data);
    }, 300);

    return () => clearTimeout(timer);
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-nmit-blue">
            Count: <span className="font-bold">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`nmit-card ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}>
      <div className="nmit-card-header">
        <h3 className="nmit-card-title">{title}</h3>
      </div>
      <div className="nmit-card-content">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={animatedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              fill={color}
              radius={[4, 4, 0, 0]}
              animationDuration={1500}
              animationEasing="ease-out"
              className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
