import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  CalendarCheck2,
  BarChart3,
  BookOpen,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import Stat from '../components/common/Stat';
import { getStudentMarks, getClassLabel, getStudentName } from '../utils/formatters';
import { getConvertedMark, getRegisterGrade } from '../utils/grading';

export function StudentDetailView({ student, onBack, onEditStudent, onPromoteStudent, isAdmin, attendanceRecords = [] }) {
  const allStudentMarks = getStudentMarks(student);
  const currentStudentYear = student.academicYear || '2024-2025';

  // Build academic history list from separate collection or fallback
  const historyList = (Array.isArray(student.academicHistory) && student.academicHistory.length > 0)
    ? student.academicHistory
    : [{
        academicYear: currentStudentYear,
        class: student.class || student.className || '',
        section: student.section || '',
        rollNumber: student.rollNumber !== null ? String(student.rollNumber) : '',
        status: student.status || 'Active'
      }];

  const historyYears = historyList.map((h) => h.academicYear).filter(Boolean);
  const markYears = allStudentMarks.map((m) => m.academicYear).filter(Boolean);
  const availableYears = Array.from(new Set([currentStudentYear, ...historyYears, ...markYears])).filter(Boolean);
  availableYears.sort((a, b) => b.localeCompare(a));

  const [selectedYear, setSelectedYear] = useState(currentStudentYear);

  useEffect(() => {
    setSelectedYear(currentStudentYear);
  }, [student.id, student._id, currentStudentYear]);

  const partBNames = ['computer', 'physical education', 'moral science', 'drawing', 'general knowledge'];
  const isPartB = (m) => m.part === 'Part B' || partBNames.includes(String(m.subject || '').trim().toLowerCase());

  // Marks linked specifically to the selected academic session
  const yearMarks = allStudentMarks.filter((m) => (m.academicYear || currentStudentYear) === selectedYear);
  const studentMarks = yearMarks.filter((m) => !isPartB(m));

  const historyEntry = historyList.find((h) => h.academicYear === selectedYear);
  const effectiveClass = historyEntry
    ? (historyEntry.section ? `${historyEntry.class || historyEntry.className} ${historyEntry.section}`.trim() : (historyEntry.class || historyEntry.className))
    : (selectedYear === currentStudentYear ? getClassLabel(student) : (yearMarks[0]?.className || getClassLabel(student)));

  const average = studentMarks.length
    ? Math.round(studentMarks.reduce((a, m) => a + ((Number(m.score || 0) / Math.max(Number(m.maxScore || 100), 1)) * 100), 0) / studentMarks.length)
    : 0;

  const groupedMarks = studentMarks.reduce((groups, mark) => {
    const exam = mark.examType || 'Other';
    (groups[exam] ||= []).push(mark);
    return groups;
  }, {});

  const subjectRows = Array.from(new Set(studentMarks.map((mark) => mark.subject).filter(Boolean))).map((subject) => {
    const subjectMarks = studentMarks.filter((mark) => mark.subject === subject);
    const findMark = (examType) => subjectMarks.find((mark) => mark.examType === examType);
    const value = (examType) => getConvertedMark(findMark(examType) || { examType, score: 0 });
    const oral = (examType) => Number(findMark(examType)?.oralScore || 0);
    const values = { fa1: value('FA1'), fa2: value('FA2'), sa1: value('SA1'), oralSa1: oral('SA1'), fa3: value('FA3'), fa4: value('FA4'), sa2: value('SA2'), oralSa2: oral('SA2') };
    const finalScore = Object.values(values).reduce((sum, markValue) => sum + markValue, 0);
    const finalGrade = getRegisterGrade(Math.round((finalScore / 100) * 100), 100, effectiveClass);
    return { subject, ...values, finalScore, finalGrade };
  });

  // Attendance linked to this student
  const studentAttendance = (attendanceRecords || []).filter((entry) => {
    const sid = entry.studentId?.id || entry.studentId?._id || entry.studentId;
    return sid && String(sid) === String(student.id || student._id);
  });

  let studentAttendanceValue = '0%';
  let studentAttendanceTrend = 'No records yet';

  if (studentAttendance.length > 0) {
    const present = studentAttendance.reduce((tot, r) => {
      if (r.status === 'Present') return tot + 1;
      if (r.status === 'Half Day') return tot + 0.5;
      return tot;
    }, 0);
    const pct = Math.round((present / studentAttendance.length) * 100);
    studentAttendanceValue = `${pct}%`;
    studentAttendanceTrend = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : 'Needs attention';
  }

  const studentFullName = getStudentName(student);
  const admissionNumber = student.admissionNumber || student.admissionNo || '—';
  const firstInit = (student.firstName?.[0] || studentFullName?.[0] || 'S').toUpperCase();
  const lastInit = (student.lastName?.[0] || studentFullName?.split(' ')?.[1]?.[0] || '').toUpperCase();

  return (
    <div className="content">
      {/* Top Bar Actions */}
      <div className="detail-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px' }}>
        <button className="back-button" onClick={onBack} style={{ margin: 0 }}>← Back to students</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className="outline-button" onClick={() => onEditStudent(student)}>Edit student</button>
          {isAdmin && student.status !== 'Graduated' && (
            <button className="outline-button" onClick={() => onPromoteStudent?.(student)}>
              <GraduationCap size={15} /> Promote Student
            </button>
          )}
        </div>
      </div>

      {/* Hero Header */}
      <div className="detail-hero" style={{ marginBottom: '24px' }}>
        <div className="large-avatar">{firstInit}{lastInit}</div>
        <div>
          <span className="eyebrow">STUDENT PROFILE & ACADEMIC DOSSIER</span>
          <h1 style={{ margin: '4px 0 8px' }}>{studentFullName}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>
            Admission No: <strong>{admissionNumber}</strong> · Current Class: <strong>{getClassLabel(student)}</strong> · Roll No: <strong>{student.rollNumber || '—'}</strong>
          </p>
        </div>
        <span
          className="status-pill"
          style={{
            background: student.status === 'Graduated' ? '#fae3db' : '#e1eddf',
            color: student.status === 'Graduated' ? '#c9664e' : '#4b8e2d',
            fontWeight: 700
          }}
        >
          {student.status === 'Graduated' ? 'Graduated' : `Active · ${currentStudentYear}`}
        </span>
      </div>

      {/* Two-Column Grid: Student Profile + Academic History Collection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Card 1: Student Personal Information */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--line)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eef3f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#102d77' }}>
              <User size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Student Personal Information</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>Master student profile & parent contact details</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', fontSize: '13px' }}>
            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Admission Number</span>
              <strong style={{ color: '#102d77' }}>{admissionNumber}</strong>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Student Full Name</span>
              <strong>{studentFullName}</strong>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Date of Birth</span>
              <span>{student.dateOfBirth || '—'}</span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Father's Name</span>
              <span>{student.fatherName || student.parentName || '—'}</span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Mother's Name</span>
              <span>{student.motherName || '—'}</span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Parent Mobile</span>
              <strong style={{ color: '#1237ac' }}>{student.parentMobile ? `+91 ${student.parentMobile.slice(-10)}` : '—'}</strong>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Parent / Student Email</span>
              <span>{student.parentEmail || student.email || '—'}</span>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Residential Address</span>
              <span>{student.address || '—'}</span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Enrollment Status</span>
              <span style={{ fontWeight: 600, color: student.status === 'Graduated' ? '#c9664e' : '#4b8e2d' }}>
                {student.status || 'Active'}
              </span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Academic Year</span>
              <span>{currentStudentYear}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Student Academic History Collection */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--line)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e1eddf', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b8e2d' }}>
              <GraduationCap size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Academic History Collection</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>Year-by-year class progression (never deleted)</p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#faf9f4', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '8px 10px', color: 'var(--muted)' }}>Year</th>
                  <th style={{ padding: '8px 10px', color: 'var(--muted)' }}>Class</th>
                  <th style={{ padding: '8px 10px', color: 'var(--muted)' }}>Section</th>
                  <th style={{ padding: '8px 10px', color: 'var(--muted)' }}>Roll</th>
                  <th style={{ padding: '8px 10px', color: 'var(--muted)' }}>Status</th>
                  <th style={{ padding: '8px 10px', color: 'var(--muted)', textAlign: 'right' }}>View</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((entry, idx) => {
                  const yr = entry.academicYear;
                  const isSelected = yr === selectedYear;
                  const isCurrent = yr === currentStudentYear;
                  const isPromoted = entry.status === 'Promoted';

                  return (
                    <tr
                      key={entry.id || entry._id || `${yr}-${idx}`}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        background: isSelected ? '#f0f5ff' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: isSelected ? '#1237ac' : 'inherit' }}>
                        {yr}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        Class {entry.class || entry.className || '—'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {entry.section || '—'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {entry.rollNumber ? `#${entry.rollNumber}` : '—'}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: isPromoted ? '#e1eddf' : isCurrent ? '#dbeafe' : '#f1f5f9',
                            color: isPromoted ? '#2e7d32' : isCurrent ? '#1e40af' : '#475569'
                          }}
                        >
                          {entry.status || (isCurrent ? 'Active' : 'Archived')}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedYear(yr)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: isSelected ? '1px solid #1237ac' : '1px solid var(--line)',
                            background: isSelected ? '#1237ac' : '#fff',
                            color: isSelected ? '#fff' : '#102d77',
                            cursor: 'pointer'
                          }}
                        >
                          {isSelected ? 'Active View' : 'Select'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '14px', padding: '10px 12px', background: '#faf9f4', borderRadius: '10px', fontSize: '11px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#4b8e2d" style={{ flexShrink: 0 }} />
            <span>
              Previous academic records are permanently archived when promoting students. Marks and attendance remain linked to their respective session.
            </span>
          </div>
        </div>
      </div>

      {/* Stats for Selected Academic Session */}
      <div className="detail-stats" style={{ marginBottom: '24px' }}>
        <Stat label="Attendance" value={studentAttendanceValue} trend={studentAttendanceTrend} icon={CalendarCheck2} tone="blue" />
        <Stat label="Average mark" value={`${average}%`} trend={studentMarks.length ? `Session ${selectedYear}` : 'No marks yet'} icon={BarChart3} tone="yellow" />
        <Stat label="Subjects enrolled" value={new Set(studentMarks.map((mark) => mark.subject).filter(Boolean)).size.toString().padStart(2, '0')} trend={`Class ${effectiveClass}`} icon={BookOpen} tone="coral" />
      </div>

      {/* Section Heading with Session Tabs */}
      <div className="section-heading">
        <div>
          <span className="eyebrow">ACADEMIC SESSION: {selectedYear} (CLASS {effectiveClass.toUpperCase()})</span>
          <h2>Examination Marks & Assessment Records</h2>
        </div>
        {availableYears.length > 1 && (
          <div className="entry-tabs" style={{ margin: 0 }}>
            {availableYears.map((yr) => (
              <button
                key={yr}
                className={selectedYear === yr ? 'active' : ''}
                onClick={() => setSelectedYear(yr)}
              >
                {yr} {yr === currentStudentYear ? '(Current)' : '(Archived)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Marks Summary Table */}
      {subjectRows.length > 0 && (
        <div className="table-wrap student-marks-summary">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>FA1</th>
                <th>FA2</th>
                <th>SA1</th>
                <th>Oral SA1</th>
                <th>FA3</th>
                <th>FA4</th>
                <th>SA2</th>
                <th>Oral SA2</th>
                <th>Final score</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {subjectRows.map((row) => (
                <tr key={row.subject}>
                  <td><strong>{row.subject}</strong></td>
                  <td>{row.fa1}</td>
                  <td>{row.fa2}</td>
                  <td>{row.sa1}</td>
                  <td>{row.oralSa1}</td>
                  <td>{row.fa3}</td>
                  <td>{row.fa4}</td>
                  <td>{row.sa2}</td>
                  <td>{row.oralSa2}</td>
                  <td><strong>{row.finalScore}</strong></td>
                  <td><span className="grade-badge">{row.finalGrade}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Exam Detail Cards */}
      {studentMarks.length ? (
        Object.entries(groupedMarks).map(([exam, marks]) => (
          <section className="exam-section" key={exam}>
            <div className="exam-heading">
              <h3>{exam} ({selectedYear})</h3>
              <span>{marks.length} subject{marks.length === 1 ? '' : 's'}</span>
            </div>
            <div className="marks-grid">
              {marks.map((mark) => (
                <div className="mark-card" key={mark.id || `${exam}-${mark.subject}`}>
                  <div className="subject-icon"><BookOpen size={18} /></div>
                  <div className="mark-info">
                    <strong>{mark.subject}</strong>
                    <span>{mark.part || 'Part A'} · {mark.academicYear || selectedYear}</span>
                    <small>{mark.subjectTeacher?.name || mark.teacher?.name || 'Assigned teacher'}</small>
                  </div>
                  <div className="mark-score">
                    <strong>{mark.score}</strong>
                    <small>/{mark.maxScore || 100}{mark.examType?.startsWith('SA') ? ` + Oral ${mark.oralScore || 0}/10` : ''}</small>
                    <div className="mini-progress">
                      <span style={{ width: `${((Number(mark.score || 0) / Math.max(Number(mark.maxScore || 100), 1)) * 100)}%` }}></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty-state">
          <div className="empty-icon"><BookOpen /></div>
          <h2>No marks recorded for {selectedYear}</h2>
          <p>
            {selectedYear === currentStudentYear
              ? `This student is currently enrolled in Class ${getClassLabel(student)} for session ${selectedYear}. Marks entered for this academic year will appear here.`
              : `No marks found for historical session ${selectedYear}. All past records are preserved in their respective academic years.`}
          </p>
        </div>
      )}
    </div>
  );
}

export default StudentDetailView;
