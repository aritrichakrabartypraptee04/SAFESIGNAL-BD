import React from 'react';
import { CloudRain, CloudLightning, CloudSunRain, CloudSun, Sun } from 'lucide-react';
import { ForecastDay } from '../types';
import { cn } from '../lib/utils';

const FORECAST_DATA: ForecastDay[] = [
  { day: 'TODAY', icon: 'storm', rainfall: 92, risk: 'High' },
  { day: 'MON', icon: 'rain', rainfall: 78, risk: 'High' },
  { day: 'TUE', icon: 'storm', rainfall: 65, risk: 'High' },
  { day: 'WED', icon: 'sun-rain', rainfall: 31, risk: 'Medium' },
  { day: 'THU', icon: 'cloud-sun', rainfall: 18, risk: 'Medium' },
  { day: 'FRI', icon: 'cloud-sun', rainfall: 9, risk: 'Low' },
  { day: 'SAT', icon: 'sun', rainfall: 4, risk: 'Low' },
];

export const ForecastEngine: React.FC = () => {
  const [selectedDay, setSelectedDay] = React.useState('TODAY');

  const getIcon = (iconType: ForecastDay['icon']) => {
    switch (iconType) {
      case 'rain': return <CloudRain className="w-8 h-8" />;
      case 'storm': return <CloudLightning className="w-8 h-8" />;
      case 'sun-rain': return <CloudSunRain className="w-8 h-8" />;
      case 'cloud-sun': return <CloudSun className="w-8 h-8" />;
      case 'sun': return <Sun className="w-8 h-8" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'High': return 'bg-red-500';
      case 'Medium': return 'bg-amber-500';
      case 'Low': return 'bg-green-600';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-[#2A2A28] rounded-[3rem] p-10 shadow-2xl border border-white/5">
      <h2 className="text-2xl font-black tracking-tighter uppercase text-white/70 mb-10 px-2">
        7-Day Forecast <span className="text-white/30">(ResilentAI Prediction Engine)</span>
      </h2>
      
      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
        {FORECAST_DATA.map((item) => (
          <button
            key={item.day}
            onClick={() => setSelectedDay(item.day)}
            className={cn(
              "flex flex-col items-center justify-between min-w-[110px] h-[190px] rounded-[2.5rem] p-6 transition-all duration-300",
              selectedDay === item.day 
                ? "bg-[#E6F4FE] text-[#2A2A28] shadow-2xl scale-105" 
                : "bg-[#1C1C1A] text-white/50 hover:bg-[#252523]"
            )}
          >
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              selectedDay === item.day ? "opacity-40" : "opacity-80"
            )}>
              {item.day}
            </span>
            
            <div className={cn(
              "transition-transform duration-300",
              selectedDay === item.day ? "scale-110 text-[#2A2A28]" : "text-white/40"
            )}>
              {getIcon(item.icon)}
            </div>
            
            <div className="flex flex-col items-center gap-3">
              <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", getRiskColor(item.risk))} />
              <span className={cn(
                "text-base font-black tracking-tight",
                selectedDay === item.day ? "text-[#2A2A28]/40" : "text-white/30"
              )}>
                {item.rainfall}mm
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
