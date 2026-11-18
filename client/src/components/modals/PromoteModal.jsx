import React, { useState, useMemo, useEffect } from 'react';
import { X, GraduationCap, Search, CheckCircle2, ArrowRight } from 'lucide-react';
import { getClassLabel, getStudentName } from '../../utils/formatters';
import { getNextClass, getNextAcademicYear } from '../../utils/grading';

const standardClasses = [
  '1 A', '1 B', '2 A', '2 B', '3 A', '3 B', '4 A', '4 B', '5 A', '5 B',
  '6 A', '6 B', '7 A', '7 B', '8 A', '8 B', '9 A', '9 B', '10 A', '10 B'
];

export function PromoteModal({ onClose, onPromote, students, initialScope }) {
  const activeStudents = useMemo(() => {
    return (students || []).filter((s) => s.status !== 'Graduated');
  }, [students]);

  const classList = useMemo(() => {
    return Array.from(new Set(activeStudents.map((s) => getClassLabel(s)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [activeStudents]);

  const availableClasses = useMemo(() => {
    return Array.from(new Set([...classList, ...standardClasses])).sort((a, b) => {
      const numA = parseInt(a, 10) || 0;
      const numB = parseInt(b, 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
  }, [classList]);

  const activeYear = students?.find((s) => s.academicYear && s.status !== 'Graduated')?.academicYear || '2024-2025';
  const defaultNextYear = getNextAcademicYear(activeYear);

  // Workflow State
  const [sourceYear, setSourceYear] = useState(activeYear);
  const [targetYear, setTargetYear] = useState(defaultNextYear);
  const [selectedClass, setSelectedClass] = useState(initialScope?.className || '');
  const [targetClass, setTargetClass] = useState(() => {
    if (initialScope?.student) {
      return getNextClass(getClassLabel(initialScope.student)) || '';
    }
    if (initialScope?.className) {
      return getNextClass(initialScope.className) || '';
    }
    return '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Automatically suggest next class when source class is chosen
  useEffect(() => {
    if (selectedClass && (!targetClass || targetClass === 'auto')) {
      const suggested = getNextClass(selectedClass);
      if (suggested) setTargetClass(suggested);
    }
  }, [selectedClass]);

  // Checklist of student IDs
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
      const adm = String(s.admissionNo || s.admissionNumber || '').toLowerCase();
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
    if (!targetClass.trim()) {
      setError('Please select the Next Class. Selecting the next class is mandatory.');
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
        sourceYear: sourceYear.trim(),
        currentYear: sourceYear.trim(),
        targetYear: targetYear.trim(),
        targetClass: targetClass.trim(),
        className: selectedClass || undefined,
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
      <form className="modal" style={{ width: 'min(760px, 98vw)', maxHeight: '92vh', overflowY: 'auto' }} onSubmit={handleSubmit}>
        <div className="modal-head">
          <div>
            <span className="eyebrow" style={{ color: '#1237ac' }}>ACADEMIC YEAR PROGRESSION</span>
            <h2>Promote to Next Academic Year</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={19} /></button>
        </div>

        <p className="modal-help" style={{ marginBottom: '14px' }}>
          Advance students to their next academic year. New academic history records will be created without deleting previous records.
        </p>

        {error && <div className="error" style={{ marginBottom: '12px' }}>{error}</div>}

        {/* Step 1: Select Academic Year */}
        <div style={{ background: '#faf9f4', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#102d77', textTransform: 'uppercase', marginBottom: '8px' }}>
            Step 1: Academic Year Progression
          </div>
          <div className="form-row" style={{ margin: 0 }}>
            <label>
              Current Academic Year
              <input
                type="text"
                value={sourceYear}
                onChange={(e) => setSourceYear(e.target.value)}
                placeholder="Current Session"
                required
              />
            </label>
            <label>
              Target Academic Year *
              <input
                type="text"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                placeholder="e.g. 2027-2028"
                required
              />
            </label>
          </div>
        </div>

        {/* Step 2 & 4: Class & Next Class Selection */}
        <div style={{ background: '#faf9f4', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#102d77', textTransform: 'uppercase', marginBottom: '8px' }}>
                Step 2: Filter Source Class
              </div>
              <label style={{ margin: 0 }}>
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

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#1237ac', textTransform: 'uppercase', marginBottom: '8px' }}>
                Step 4: Choose Next Class * (Mandatory)
              </div>
              <label style={{ margin: 0 }}>
                <select
                  value={targetClass}
                  onChange={(e) => {
                    setTargetClass(e.target.value);
                    if (error) setError('');
                  }}
                  required
                >
                  <option value="">-- Select Next Class (Mandatory) --</option>
                  <option value="auto">Auto-Advance Each Student (+1 Grade)</option>
                  {availableClasses.map((cls) => (
                    <option value={cls} key={cls}>
                      Class {cls}
                    </option>
                  ))}
                  <option value="Graduated">Graduated (Completed School)</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* Step 3: Display Student List with Checklist */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#102d77', textTransform: 'uppercase' }}>
                Step 3: Select Students to Promote
              </span>
            </div>

            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, roll..."
                style={{ paddingLeft: '32px', height: '32px', fontSize: '12px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

            <div className="term-pill" style={{ padding: '3px 8px', fontSize: '11px' }}>
              <strong>{selectedIds.size}</strong> of {activeStudents.length} selected
            </div>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '10px', background: '#faf9f4' }}>
            {displayedStudents.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                No active students match this filter.
              </div>
            ) : (
              <table style={{ margin: 0, fontSize: '12px', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#f0ede4', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={{ padding: '8px 10px', width: '36px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isAllDisplayedSelected}
                        onChange={toggleSelectAllDisplayed}
                        style={{ width: '15px', height: '15px', cursor: 'pointer', margin: 0 }}
                      />
                    </th>
                    <th style={{ padding: '8px 10px' }}>Student</th>
                    <th style={{ padding: '8px 10px' }}>Current Class</th>
                    <th style={{ padding: '8px 10px' }}>Next Class</th>
                    <th style={{ padding: '8px 10px' }}>Roll / Adm</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStudents.map((s) => {
                    const sid = s.id || s._id;
                    const isSelected = selectedIds.has(sid);
                    const currentCls = getClassLabel(s);
                    const computedNext = targetClass === 'auto'
                      ? getNextClass(currentCls)
                      : (targetClass || getNextClass(currentCls));
                    const isGrad = computedNext === 'Graduated' || /graduated/i.test(computedNext);

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
                        <td style={{ padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudent(sid)}
                            style={{ width: '15px', height: '15px', cursor: 'pointer', margin: 0 }}
                          />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <strong>{getStudentName(s)}</strong>
                        </td>
                        <td style={{ padding: '6px 10px' }}>{currentCls}</td>
                        <td style={{ padding: '6px 10px' }}>
                          {targetClass ? (
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
                              {computedNext}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#a0aec0', fontStyle: 'italic' }}>
                              Select next class above
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>
                          {s.rollNumber ? `Roll ${s.rollNumber}` : (s.admissionNumber || s.admissionNo)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Step 5: Explanation & Confirmation */}
        <div style={{ padding: '10px 12px', background: '#eef3f7', borderRadius: '10px', fontSize: '11px', color: '#102d77', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <CheckCircle2 size={16} color="#1237ac" style={{ flexShrink: 0 }} />
          <span>
            <strong>Step 5 (Confirm):</strong> New academic history records will be created for {targetYear}. Previous academic records ({sourceYear}) remain permanently archived as "Promoted". Existing marks and attendance are preserved and never deleted.
          </span>
        </div>

        <div className="modal-actions" style={{ margin: 0 }}>
          <button type="button" className="outline-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={loading || selectedIds.size === 0 || !targetClass.trim()}>
            <GraduationCap size={16} />
            {loading
              ? 'Promoting...'
              : !targetClass.trim()
                ? 'Select Next Class to Promote'
                : selectedIds.size === activeStudents.length
                  ? `Confirm Promotion for All ${selectedIds.size} Students`
                  : `Confirm Promotion for ${selectedIds.size} Selected Student(s)`}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PromoteModal;
