"use client";

import { ReactNode } from "react";

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  gradient?: string;
  onClick?: () => void;
}

export function StatsCard({ icon, label, value, trend, gradient, onClick }: StatsCardProps) {
  const defaultGradient = "from-[#18122D] to-[#1a0b2e]";

  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${gradient || defaultGradient} rounded-3xl p-6 border-2 border-[#EB83EA]/20 hover:border-[#EB83EA]/40 transition-all shadow-lg hover:shadow-xl hover:shadow-[#EB83EA]/20 ${
        onClick ? "cursor-pointer hover:scale-[1.02]" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EB83EA] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#EB83EA]/30">
          {icon}
        </div>
        {trend && (
          <div
            className={`text-sm font-bold ${
              trend.isPositive ? "text-green-400" : "text-red-400"
            }`}
          >
            {trend.isPositive ? "↑" : "↓"} {trend.value}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-gray-400 text-sm font-medium">{label}</p>
        <p className="text-white text-3xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  );
}
