
import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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
        <div className="bg-white p-3 border border-gray-200 rounded-xl shadow-xl backdrop-blur-sm">
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

  const renderCenterLabel = ({ cx, cy }: any) => {
    return (
      <g>
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-gray-500 text-xs font-medium">
          Total
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" className="fill-gray-900 text-2xl font-bold">
          {total}
        </text>
      </g>
    );
  };

  return (
    <div className={`w-full ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}>
      <div className="flex flex-col items-center p-6">
        {/* Chart Container */}
        <div className="w-[240px] h-[240px] mb-6 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {/* Gradient definitions for approved, pending, rejected */}
                <linearGradient id="approvedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="pendingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <linearGradient id="rejectedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
              <Pie
                data={animatedData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
                animationBegin={0}
                animationDuration={1500}
                animationEasing="ease-out"
              >
                {animatedData.map((entry, index) => {
                  let fillColor = entry.color;
                  if (entry.name === 'Approved') fillColor = 'url(#approvedGradient)';
                  else if (entry.name === 'Pending Review') fillColor = 'url(#pendingGradient)';
                  else if (entry.name === 'Rejected') fillColor = 'url(#rejectedGradient)';
                  
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={fillColor}
                      className="hover:opacity-90 transition-all duration-300 cursor-pointer drop-shadow-sm"
                      stroke="white"
                      strokeWidth={2}
                    />
                  );
                })}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {total > 0 && renderCenterLabel({ cx: '50%', cy: '50%' })}
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Horizontal Legend */}
        <div className="flex flex-wrap justify-center items-center gap-6">
          {data.map((item, index) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
            return (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-700 font-medium">{item.name}</span>
                <span className="text-sm text-gray-900 font-semibold">{item.value}</span>
                <span className="text-xs text-gray-500">({percentage}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
