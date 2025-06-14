
import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartData } from '@/types';

interface AnimatedPieChartProps {
  data: ChartData[];
  title: string;
  height?: number;
}

const COLORS = ['#2C2E83', '#FFCC00', '#4F46E5', '#EF4444', '#10B981', '#F59E0B'];

export const AnimatedPieChart: React.FC<AnimatedPieChartProps> = ({
  data,
  title,
  height = 300
}) => {
  const [animatedData, setAnimatedData] = useState<ChartData[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    // Animate pie chart data loading
    const timer = setTimeout(() => {
      setAnimatedData(data);
    }, 300);

    return () => clearTimeout(timer);
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-nmit-blue">
            Count: <span className="font-bold">{data.value}</span>
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
          <PieChart>
            <Pie
              data={animatedData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              animationBegin={0}
              animationDuration={1500}
              animationEasing="ease-out"
            >
              {animatedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || COLORS[index % COLORS.length]}
                  className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
