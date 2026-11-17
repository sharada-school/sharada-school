import React, { useState, useMemo } from 'react';
import { X, GraduationCap, Search } from 'lucide-react';
import { getClassLabel, getStudentName } from '../../utils/formatters';
import { getNextClass, getNextAcademicYear } from '../../utils/grading';

export function PromoteModal({ onClose, onPromote, students, initialScope }) {
  const activeStudents = useMemo(() => {
    return (students || []).filter((s) => s.status !== 'Graduated');
  }, [students]);

  const classList = useMemo(() => {
    return Array.from(new Set(activeStudents.map((s) => getClassLabel(s)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [activeStudents]);

  const activeYear = students?.find((s) => s.academicYear && s.status !== 'Graduated')?.academicYear || '2024-2025';
  const defaultNextYear = getNextAcademicYear(activeYear);
  const [targetYear, setTargetYear] = useState(defaultNextYear);
  const [selectedClass, setSelectedClass] = useState(initialScope?.className || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initial selection
  const [selectedIds, setSelectedIds] = useState(() => {
    if (initialScope?.student) {
      const id = initialScope.student.id || initialScope.student._id;
      return new Set(id ? [id] : []);
    }
    if (initialScope?.mode === 'class' && initialScope?.className) {
      const classStudentIds = activeStudents
        .filter((s) => getClassLabel(s) === initialScope.className)
        .map((s) => s.id || s._id);
      return new Set(classStudentIds);
    }
    // Default to all active students
    return new Set(activeStudents.map((s) => s.id || s._id));
  });

  // Filter students based on class selection and search query
  const displayedStudents = useMemo(() => {
    return activeStudents.filter((s) => {
      const matchesClass = !selectedClass || getClassLabel(s) === selectedClass;
      if (!matchesClass) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = getStudentName(s).toLowerCase();
      const adm = String(s.admissionNo || '').toLowerCase();
      const roll = String(s.rollNumber || '').toLowerCase();
      return name.includes(q) || adm.includes(q) || roll.includes(q);
    });
  }, [activeStudents, selectedClass, searchQuery]);

  const isAllDisplayedSelected =
    displayedStudents.length > 0 &&
    displayedStudents.every((s) => selectedIds.has(s.id || s._id));

  const toggleSelectAllDisplayed = () => {
    const next = new Set(selectedIds);
    if (isAllDisplayedSelected) {
      displayedStudents.forEach((s) => next.delete(s.id || s._id));
    } else {
      displayedStudents.forEach((s) => next.add(s.id || s._id));
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(activeStudents.map((s) => s.id || s._id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const toggleStudent = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetYear.trim()) {
      setError('Please provide a target academic year.');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Please select at least one student to promote.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        targetYear: targetYear.trim(),
        studentIds: Array.from(selectedIds),
        scope: selectedIds.size === activeStudents.length ? 'all' : 'selected'
      };
      await onPromote(payload);
    } catch (err) {
      setError(err.message || 'Promotion failed.');
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <form className="modal" style={{ width: 'min(720px, 98vw)', maxHeight: '92vh' }} onSubmit={handleSubmit}>
        <div className="modal-head">
          <div>
            <span className="eyebrow" style={{ color: '#1237ac' }}>ACADEMIC YEAR PROGRESSION</span>
            <h2>Promote to Next Academic Year</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={19} /></button>
        </div>

        <p className="modal-help">
          Advance students to their next class and start a fresh academic register for the new school year.
          You can select all students, filter by class, or check specific students below.
        </p>

        {error && <div className="error" style={{ marginBottom: '10px' }}>{error}</div>}

        <div className="form-row">
          <label>
            Target Academic Year
            <input
              type="text"
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              placeholder="Academic Year"
              required
            />
          </label>
          <label>
            Filter by Class
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">All Classes ({activeStudents.length} students)</option>
              {classList.map((cls) => (
                <option value={cls} key={cls}>
                  Class {cls} ({activeStudents.filter((s) => getClassLabel(s) === cls).length} students)
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name, roll number, or admission..."
              style={{ paddingLeft: '36px' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--muted)', pointerEvents: 'none' }} />
          </div>
        </div>

        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={isAllDisplayedSelected}
                  onChange={toggleSelectAllDisplayed}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                />
                Select All in View ({displayedStudents.length})
              </label>
              <button type="button" className="text-button" onClick={handleSelectAll} style={{ fontSize: '11px', padding: '2px 8px' }}>
                Select All ({activeStudents.length})
              </button>
              <button type="button" className="text-button" onClick={handleDeselectAll} style={{ fontSize: '11px', padding: '2px 8px', color: '#c9664e' }}>
                Clear
              </button>
            </div>
            <div className="term-pill" style={{ padding: '4px 10px', fontSize: '11px' }}>
              <span></span><strong>{selectedIds.size}</strong> of {activeStudents.length} selected
            </div>
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '12px', background: '#faf9f4' }}>
            {displayedStudents.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                No active students match this filter.
              </div>
            ) : (
              <table style={{ margin: 0, fontSize: '12px', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f0ede4', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '8px 12px', width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllDisplayedSelected}
                        onChange={toggleSelectAllDisplayed}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                        title="Select/Deselect All in View"
                      />
                    </th>
                    <th style={{ padding: '8px 12px' }}>Student</th>
                    <th style={{ padding: '8px 12px' }}>Current Class</th>
                    <th style={{ padding: '8px 12px' }}>Next Class</th>
                    <th style={{ padding: '8px 12px' }}>Roll / Adm</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStudents.map((s) => {
                    const sid = s.id || s._id;
                    const isSelected = selectedIds.has(sid);
                    const currentCls = getClassLabel(s);
                    const nextCls = getNextClass(currentCls);
                    const isGrad = nextCls === 'Graduated' || /graduated/i.test(nextCls);

                    return (
                      <tr
                        key={sid}
                        onClick={() => toggleStudent(sid)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? '#eff6ef' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '8px 12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudent(sid)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <strong>{getStudentName(s)}</strong>
                        </td>
                        <td style={{ padding: '8px 12px' }}>{currentCls}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: isGrad ? '#fae3db' : '#e1eddf',
                              color: isGrad ? '#c9664e' : '#4b8e2d',
                              display: 'inline-block'
                            }}
                          >
                            {nextCls}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>
                          {s.rollNumber ? `Roll ${s.rollNumber}` : s.admissionNo}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '18px' }}>
          <button type="button" className="outline-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={loading || selectedIds.size === 0}>
            <GraduationCap size={16} />
            {loading ? 'Promoting...' : selectedIds.size === activeStudents.length ? `Promote All ${selectedIds.size} Students` : `Promote ${selectedIds.size} Selected Student(s)`}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PromoteModal;
