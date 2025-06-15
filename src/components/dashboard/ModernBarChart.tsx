
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ChartData {
  name: string;
  value: number;
}

interface ModernBarChartProps {
  data: ChartData[];
  height?: number;
  color?: string;
}

export const ModernBarChart: React.FC<ModernBarChartProps> = ({
  data,
  height = 300,
  color = '#3b82f6'
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
        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg">
          <p className="font-semibold text-gray-900">{label}</p>
          <p className="text-gray-600">
            Count: <span className="font-bold text-blue-600">{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomBar = (props: any) => {
    const { fill, ...rest } = props;
    return (
      <Bar
        {...rest}
        fill={`url(#gradient-${color.replace('#', '')})`}
        radius={[6, 6, 0, 0]}
        className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
      />
    );
  };

  return (
    <div className={`w-full ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={animatedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="value"
            fill={color}
            radius={[6, 6, 0, 0]}
            animationDuration={1500}
            animationEasing="ease-out"
            className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
          >
            {animatedData.map((entry, index) => (
              <Cell key={`cell-${index}`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
