import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getAttendanceHistory, getFoodAccuracy, getQuickStats } from "../lib/dataClient";

export default function StatsPage() {
  const [attendance, setAttendance] = useState<{ event: string; actual: number }[]>([]);
  const [foodAccuracy, setFoodAccuracy] = useState<{ event: string; given: number; actual: number }[]>([]);
  const [quickStats, setQuickStats] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    getAttendanceHistory().then(setAttendance).catch(() => {});
    getFoodAccuracy().then(setFoodAccuracy).catch(() => {});
    getQuickStats().then(setQuickStats).catch(() => {});
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800 mb-1">Stats & reports</h2>
      <p className="text-sm text-slate-500 mb-6">Historical performance across past events</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Attendance by past event</h3>
          <p className="text-[11px] text-slate-400 mb-4">
            Completed events only — no "expected" comparison shown since predicted turnout was never recorded historically.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={attendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
              <XAxis dataKey="event" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip />
              <Bar dataKey="actual" fill="#1D4ED8" name="Attendance" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Food ordered vs. attendance</h3>
          <p className="text-[11px] text-slate-400 mb-4">
            Bars close together = accurate ordering. "Given" above "Actual" = surplus/waste; below = ran short.
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={foodAccuracy}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
              <XAxis dataKey="event" tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="given" fill="#93C5FD" name="Food ordered" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#1D4ED8" name="Actual attendance" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mt-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {quickStats.map((s) => (
            <div key={s.label} className="bg-blue-50 rounded-lg py-4">
              <p className="text-lg font-semibold text-blue-800">{s.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
