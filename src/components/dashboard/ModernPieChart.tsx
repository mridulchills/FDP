
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
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {payload?.map((entry: any, index: number) => {
          const percentage = total > 0 ? ((entry.payload.value / total) * 100).toFixed(0) : 0;
          return (
            <div key={index} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-full">
              <div 
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-gray-700">{entry.value}</span>
              <span className="text-xs text-gray-500">({percentage}%)</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCustomLabel = ({ cx, cy }: any) => {
    return (
      <g>
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-gray-900 text-sm font-bold">
          Total
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-gray-600 text-xl font-bold">
          {total}
        </text>
      </g>
    );
  };

  return (
    <div className={`w-full ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}>
      <div className="flex flex-col items-center justify-center p-4">
        {/* Chart Container with Fixed Dimensions */}
        <div className="w-[200px] h-[200px] flex items-center justify-center mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={animatedData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
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
        
        {/* Summary Stats */}
        <div className="w-full mt-4 space-y-2">
          {data.map((item, index) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
            return (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-900">{item.value}</span>
                  <span className="text-gray-500 ml-1">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
