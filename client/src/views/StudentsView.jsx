import React from 'react';
import { Search, GraduationCap, ChevronRight, Trash2 } from 'lucide-react';
import { getClassLabel, getStudentAverage, getStudentName } from '../utils/formatters';

export function StudentsView({
  students,
  query,
  setQuery,
  onStudent,
  classOptions,
  classFilter,
  setClassFilter,
  onPromoteClass,
  onDeleteStudent,
  isAdmin
}) {
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <span className="eyebrow">DIRECTORY</span>
          <h1>Students</h1>
          <p>Manage enrolment, classes, and student performance.</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, ID or class..." />
        </div>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="all">All classes</option>
          {classOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
        {isAdmin && classFilter !== 'all' && (
          <button
            type="button"
            className="outline-button"
            onClick={() => onPromoteClass?.(classFilter)}
            style={{ whiteSpace: 'nowrap' }}
          >
            <GraduationCap size={15} /> Promote Class {classFilter}
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th><th>Admission ID</th><th>Class</th><th>Contact</th><th>Performance</th><th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const name = getStudentName(s);
              const initials = name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase() || 'ST';

              return (
                <tr key={s.id || s._id} onClick={() => onStudent(s)}>
                  <td>
                    <div className="person">
                      <span className={`student-avatar a${i % 6}`}>{initials}</span>
                      <div><strong>{name}</strong><small>Roll no. {s.rollNumber || '—'}</small></div>
                    </div>
                  </td>
                  <td>{s.admissionNumber || s.admissionNo}</td>
                  <td>{getClassLabel(s)}</td>
                  <td>{s.parentMobile ? `+91 ${s.parentMobile.slice(-10)}` : (s.email || '—')}</td>
                  <td>
                    <div className="mini-progress"><span style={{ width: `${getStudentAverage(s)}%` }}></span></div>
                    <small>{getStudentAverage(s)}% avg.</small>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      {isAdmin && (
                        <button
                          type="button"
                          className="icon-button"
                          title="Delete student"
                          style={{ color: '#dc2626', padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Are you sure you want to delete ${name}? This will permanently remove the student and all associated records.`)) {
                              onDeleteStudent?.(s.id || s._id);
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <ChevronRight size={16} className="muted" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StudentsView;
