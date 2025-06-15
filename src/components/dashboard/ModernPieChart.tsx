
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
        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-lg backdrop-blur-sm">
          <p className="font-semibold text-gray-900 text-sm">{data.name}</p>
          <p className="text-gray-600 text-sm">
            Count: <span className="font-semibold text-gray-900">{data.value}</span>
          </p>
          <p className="text-gray-600 text-sm">
            Percentage: <span className="font-semibold text-gray-900">{percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs font-medium text-gray-700">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderCustomLabel = ({ cx, cy }: any) => {
    return (
      <g>
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-gray-900 text-lg font-bold">
          Total
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-gray-600 text-2xl font-bold">
          {total}
        </text>
      </g>
    );
  };

  return (
    <div className={`w-full p-4 ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}>
      <div className="flex flex-col items-center justify-center">
        {/* Chart Container with Fixed Dimensions */}
        <div className="w-[280px] h-[280px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={animatedData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                animationBegin={0}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {animatedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="hover:opacity-80 transition-all duration-200 cursor-pointer"
                    stroke="white"
                    strokeWidth={2}
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
      </div>
    </div>
  );
};
