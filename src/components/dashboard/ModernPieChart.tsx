
import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface ModernPieChartProps {
  data: ChartData[];
  total: number;
  height?: number;
}

export const ModernPieChart: React.FC<ModernPieChartProps> = ({
  data,
  total,
  height = 400
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white p-6 border border-gray-200 rounded-2xl shadow-2xl backdrop-blur-sm">
          <p className="font-bold text-gray-900 text-lg">{data.name}</p>
          <p className="text-gray-600 text-base">
            Count: <span className="font-bold text-gray-900">{data.value}</span>
          </p>
          <p className="text-gray-600 text-base">
            Percentage: <span className="font-bold text-gray-900">{percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-6 mt-6">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl">
            <div 
              className="w-4 h-4 rounded-full shadow-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-base font-semibold text-gray-700">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderCustomLabel = ({ cx, cy }: any) => {
    return (
      <g>
        <text x={cx} y={cy - 12} textAnchor="middle" className="fill-gray-900 text-xl font-bold">
          Total
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-gray-600 text-3xl font-bold">
          {total}
        </text>
      </g>
    );
  };

  return (
    <div className={`w-full ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={animatedData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={140}
            paddingAngle={3}
            dataKey="value"
            animationBegin={0}
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {animatedData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                className="hover:opacity-80 transition-all duration-200 cursor-pointer hover:scale-105"
                stroke="white"
                strokeWidth={3}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          {total > 0 && <Pie data={[{value: 1}]} cx="50%" cy="50%" innerRadius={0} outerRadius={0} dataKey="value">
            <Cell fill="transparent" />
          </Pie>}
          {total > 0 && renderCustomLabel({ cx: '50%', cy: '50%' })}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
