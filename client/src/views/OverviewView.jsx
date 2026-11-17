import React from 'react';
import { Users, ShieldCheck, CalendarCheck2, BarChart3 } from 'lucide-react';
import Stat from '../components/common/Stat';
import { getStudentMarks } from '../utils/formatters';
import { isPartBMark } from '../utils/grading';

export function OverviewView({ students = [], teachers = [], attendanceRecords = [] }) {
  const allMarks = students.flatMap((s) => getStudentMarks(s)).filter((m) => !isPartBMark(m));
  const average = allMarks.length
    ? Math.round(allMarks.reduce((a, m) => a + ((Number(m.score || 0) / Math.max(Number(m.maxScore || 100), 1)) * 100), 0) / allMarks.length)
    : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecords = (attendanceRecords || []).filter((r) => {
    if (!r.date) return false;
    const d = typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10);
    return d === todayStr;
  });

  let attendanceValue = '0%';
  let attendanceTrend = 'No records yet';

  if (todayRecords.length > 0) {
    const present = todayRecords.reduce((tot, r) => {
      if (r.status === 'Present') return tot + 1;
      if (r.status === 'Half Day') return tot + 0.5;
      return tot;
    }, 0);
    const pct = Math.round((present / todayRecords.length) * 100);
    attendanceValue = `${pct}%`;
    attendanceTrend = `${todayRecords.length} recorded today`;
  } else if (attendanceRecords && attendanceRecords.length > 0) {
    const present = attendanceRecords.reduce((tot, r) => {
      if (r.status === 'Present') return tot + 1;
      if (r.status === 'Half Day') return tot + 0.5;
      return tot;
    }, 0);
    const pct = Math.round((present / attendanceRecords.length) * 100);
    attendanceValue = `${pct}%`;
    attendanceTrend = 'Overall average';
  }

  return (
    <div className="content">
      <div className="page-title">
        <div>
          <span className="eyebrow">DASHBOARD</span>
          <h1>Overview</h1>
          <p>Key metrics and performance summary for Sharada School.</p>
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Total students" value={students.length.toString().padStart(2, '0')} trend={students.length ? 'Enrolled' : 'No students'} icon={Users} tone="coral" />
        <Stat label="Teaching staff" value={teachers.length.toString().padStart(2, '0')} trend={teachers.length ? 'Active faculty' : 'No staff'} icon={ShieldCheck} tone="sage" />
        <Stat label="Today's attendance" value={attendanceValue} trend={attendanceTrend} icon={CalendarCheck2} tone="blue" />
        <Stat label="Average performance" value={`${average}%`} trend={allMarks.length ? 'Calculated' : 'No marks yet'} icon={BarChart3} tone="yellow" />
      </div>
    </div>
  );
}

export default OverviewView;
