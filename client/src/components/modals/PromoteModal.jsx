import React, { useState, useMemo, useEffect } from 'react';
import { X, GraduationCap, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { getClassLabel, getStudentName } from '../../utils/formatters';
import { getNextClass, getNextAcademicYear } from '../../utils/grading';

const standardClassList = [
  'Nursery', 'LKG', 'UKG',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'
];

const standardSections = ['A', 'B', 'C', 'D'];

export function PromoteModal({ onClose, onPromote, students, initialScope }) {
  const activeStudents = useMemo(() => {
    return (students || []).filter((s) => s.status !== 'Graduated');
  }, [students]);

  // Extract all distinct class names (e.g. "Class 1", "Class 5")
  const classNamesList = useMemo(() => {
    const set = new Set(standardClassList);
    (activeStudents || []).forEach((s) => {
      const raw = String(s.class || s.className || '').trim();
      const cleaned = raw.replace(/\s+[A-Za-z]$/, '').trim();
      if (cleaned) {
        if (/^\d+$/.test(cleaned)) set.add(`Class ${cleaned}`);
        else if (!/^class\s+/i.test(cleaned) && /^\d+/.test(cleaned)) set.add(`Class ${cleaned}`);
        else set.add(cleaned);
      }
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
  }, [activeStudents]);

  // Extract all distinct sections (e.g. "A", "B", "C")
  const sectionsList = useMemo(() => {
    const set = new Set(standardSections);
    (activeStudents || []).forEach((s) => {
      if (s.section && String(s.section).trim()) {
        set.add(String(s.section).trim().toUpperCase());
      }
      const match = String(s.class || s.className || '').match(/\s+([A-Za-z])$/);
      if (match) set.add(match[1].toUpperCase());
    });
    return Array.from(set).sort();
  }, [activeStudents]);

  const activeYear = students?.find((s) => s.academicYear && s.status !== 'Graduated')?.academicYear || '2024-2025';
  const defaultNextYear = getNextAcademicYear(activeYear);

  // Form State
  const [sourceYear, setSourceYear] = useState(activeYear);
  const [targetYear, setTargetYear] = useState(defaultNextYear);

  // Available Academic Years for manual selection
  const availableYears = useMemo(() => {
    const set = new Set();
    const currentCalYear = new Date().getFullYear();
    for (let y = currentCalYear - 2; y <= currentCalYear + 4; y++) {
      set.add(`${y}-${y + 1}`);
    }
    (students || []).forEach((s) => {
      if (s.academicYear && String(s.academicYear).trim()) {
        set.add(String(s.academicYear).trim());
      }
    });
    if (sourceYear) set.add(sourceYear);
    if (targetYear) set.add(targetYear);
    return Array.from(set).sort();
  }, [students, sourceYear, targetYear]);

  // Manual Selection: Target Class Name
  const [targetClassName, setTargetClassName] = useState(() => {
    if (initialScope?.student) {
      const next = getNextClass(getClassLabel(initialScope.student));
      if (next && next !== 'Graduated') {
        const cleaned = next.replace(/\s+[A-Za-z]$/, '').trim();
        return /^\d+$/.test(cleaned) ? `Class ${cleaned}` : cleaned;
      }
      return next || '';
    }
    if (initialScope?.className) {
      const next = getNextClass(initialScope.className);
      if (next && next !== 'Graduated') {
        const cleaned = next.replace(/\s+[A-Za-z]$/, '').trim();
        return /^\d+$/.test(cleaned) ? `Class ${cleaned}` : cleaned;
      }
      return next || '';
    }
    return '';
  });

  // Manual Selection: Target Academic Section
  const [targetSection, setTargetSection] = useState(() => {
    if (initialScope?.student?.section) return initialScope.student.section;
    if (initialScope?.className) {
      const match = String(initialScope.className).match(/\s+([A-Za-z])$/);
      if (match) return match[1].toUpperCase();
    }
    return 'A';
  });

  // Filters for Source Students
  const [filterClass, setFilterClass] = useState(() => {
    if (initialScope?.className) {
      const cleaned = initialScope.className.replace(/\s+[A-Za-z]$/, '').trim();
      return /^\d+$/.test(cleaned) ? `Class ${cleaned}` : cleaned;
    }
    return '';
  });

  const [filterSection, setFilterSection] = useState(() => {
    if (initialScope?.className) {
      const match = String(initialScope.className).match(/\s+([A-Za-z])$/);
      return match ? match[1].toUpperCase() : '';
    }
    return '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initial student selection checklist
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

  // Filter students based on manual class filter, section filter and search query
  const displayedStudents = useMemo(() => {
    return activeStudents.filter((s) => {
      const rawClass = String(s.class || s.className || '').trim();
      let sCls = rawClass.replace(/\s+[A-Za-z]$/, '').trim();
      if (/^\d+$/.test(sCls)) sCls = `Class ${sCls}`;

      let sSec = String(s.section || '').trim().toUpperCase();
      if (!sSec) {
        const secMatch = rawClass.match(/\s+([A-Za-z])$/);
        if (secMatch) sSec = secMatch[1].toUpperCase();
      }

      if (filterClass && sCls.toLowerCase() !== filterClass.toLowerCase()) return false;
      if (filterSection && sSec !== filterSection.toUpperCase()) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = getStudentName(s).toLowerCase();
      const adm = String(s.admissionNo || s.admissionNumber || '').toLowerCase();
      const roll = String(s.rollNumber || '').toLowerCase();
      return name.includes(q) || adm.includes(q) || roll.includes(q);
    });
  }, [activeStudents, filterClass, filterSection, searchQuery]);

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

  const finalTargetClass = targetClassName === 'Graduated'
    ? 'Graduated'
    : targetSection
      ? `${targetClassName} ${targetSection}`.trim()
      : targetClassName;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetYear.trim()) {
      setError('Please provide a target academic year.');
      return;
    }
    if (!targetClassName.trim()) {
      setError('Please manually select the Next Class Name.');
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
        targetClass: finalTargetClass,
        targetClassName: targetClassName.trim(),
        targetSection: targetClassName === 'Graduated' ? '' : targetSection.trim(),
        nextClass: finalTargetClass,
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
      <form className="modal" style={{ width: 'min(820px, 98vw)', maxHeight: '92vh', overflowY: 'auto' }} onSubmit={handleSubmit}>
        <div className="modal-head">
          <div>
            <span className="eyebrow" style={{ color: '#1237ac' }}>ACADEMIC YEAR PROGRESSION</span>
            <h2>Promote to Next Academic Year</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={19} /></button>
        </div>

        <p className="modal-help" style={{ margin: '0 0 16px 0', fontSize: '13px' }}>
          Advance students to the next school year. Manually select the target class and academic section below.
        </p>

        {error && (
          <div className="error" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fae3db', borderRadius: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: SELECT ACADEMIC YEAR (PROGRESSION) */}
        <div style={{ background: '#faf9f4', padding: '14px', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#102d77', textTransform: 'uppercase', marginBottom: '10px' }}>
            Step 1: Select Academic Year (Progression)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* From Academic Year */}
            <label style={{ display: 'grid', gap: '6px', fontWeight: 600, color: 'var(--ink)' }}>
              <span>From Academic Year <span style={{ color: '#c9664e' }}>*</span></span>
              <select
                value={sourceYear}
                onChange={(e) => {
                  const newSource = e.target.value;
                  setSourceYear(newSource);
                  setTargetYear(getNextAcademicYear(newSource));
                }}
                style={{ fontWeight: 600, padding: '9px 12px', fontSize: '13px' }}
                required
              >
                {availableYears.map((yr) => (
                  <option value={yr} key={`src-${yr}`}>{yr}</option>
                ))}
              </select>
            </label>

            {/* To Next Academic Year */}
            <label style={{ display: 'grid', gap: '6px', fontWeight: 700, color: '#1237ac' }}>
              <span>To Next Academic Year <span style={{ color: '#c9664e' }}>*</span></span>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                style={{ fontWeight: 600, padding: '9px 12px', fontSize: '13px', border: '1.5px solid #1237ac', background: '#fff' }}
                required
              >
                <option value="">-- Select Next Academic Year --</option>
                {availableYears.map((yr) => (
                  <option value={yr} key={`tgt-${yr}`}>{yr}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* STEP 2: SOURCE STUDENT FILTERS */}
        <div style={{ background: '#faf9f4', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#102d77', textTransform: 'uppercase', marginBottom: '8px' }}>
            Step 2: Filter Current Students to Promote
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.6fr', gap: '12px' }}>
            {/* Filter Current Class */}
            <label style={{ display: 'grid', gap: '5px', fontWeight: 600, color: 'var(--ink)' }}>
              <span>Current Class</span>
              <select
                value={filterClass}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterClass(val);
                  if (val) {
                    const next = getNextClass(val);
                    if (next && next !== 'Graduated') {
                      const cleaned = next.replace(/\s+[A-Za-z]$/, '').trim();
                      setTargetClassName(/^\d+$/.test(cleaned) ? `Class ${cleaned}` : cleaned);
                    } else if (next === 'Graduated') {
                      setTargetClassName('Graduated');
                    }
                  }
                }}
              >
                <option value="">All Current Classes</option>
                {classNamesList.map((cls) => (
                  <option value={cls} key={cls}>{cls}</option>
                ))}
              </select>
            </label>

            {/* Filter Current Section */}
            <label style={{ display: 'grid', gap: '5px', fontWeight: 600, color: 'var(--ink)' }}>
              <span>Current Section</span>
              <select
                value={filterSection}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterSection(val);
                  if (val && !targetSection) {
                    setTargetSection(val);
                  }
                }}
              >
                <option value="">All Sections</option>
                {sectionsList.map((sec) => (
                  <option value={sec} key={sec}>{sec}</option>
                ))}
              </select>
            </label>

            {/* Search input */}
            <label style={{ display: 'grid', gap: '5px', fontWeight: 600, color: 'var(--ink)' }}>
              <span>Search Students</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, roll or admission..."
                  style={{ paddingLeft: '34px' }}
                />
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
              </div>
            </label>
          </div>
        </div>

        {/* STEP 3: CHOOSE NEXT CLASS & SECTION (TARGET) */}
        <div style={{ background: '#f4f7fd', padding: '14px', borderRadius: '12px', border: '1.5px solid #1237ac', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#102d77', textTransform: 'uppercase', marginBottom: '10px' }}>
            Step 3: Choose Next Class & Academic Section (Target) <span style={{ color: '#c9664e' }}>*</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
            {/* Manual Selection: Next Class Name */}
            <label style={{ display: 'grid', gap: '6px', fontWeight: 700, color: '#1237ac' }}>
              <span>Next Class Name <span style={{ color: '#c9664e' }}>*</span></span>
              <select
                value={targetClassName}
                onChange={(e) => {
                  setTargetClassName(e.target.value);
                  if (error) setError('');
                }}
                style={{
                  fontWeight: 600,
                  fontSize: '14px',
                  padding: '9px 12px',
                  border: !targetClassName ? '2px solid #e87d63' : '2px solid #1237ac',
                  background: !targetClassName ? '#fff8f6' : '#fff'
                }}
                required
              >
                <option value="">-- Manual Next Class Selection --</option>
                {classNamesList.map((cls) => (
                  <option value={cls} key={cls}>
                    {cls}
                  </option>
                ))}
                <option value="Graduated">Graduated (Completed School)</option>
              </select>
            </label>

            {/* Manual Selection: Academic Section */}
            <label style={{ display: 'grid', gap: '6px', fontWeight: 700, color: '#1237ac' }}>
              <span>Next Academic Section <span style={{ color: '#c9664e' }}>*</span></span>
              <select
                value={targetSection}
                onChange={(e) => setTargetSection(e.target.value)}
                disabled={targetClassName === 'Graduated'}
                style={{ fontWeight: 600, fontSize: '14px', padding: '9px 12px' }}
              >
                <option value="">No Section</option>
                {sectionsList.map((sec) => (
                  <option value={sec} key={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* STEP 4: STUDENT CHECKLIST TABLE */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
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

          <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '12px', background: '#faf9f4' }}>
            {displayedStudents.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
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
                        title="Toggle selection for all students in view"
                      />
                    </th>
                    <th style={{ padding: '8px 10px' }}>Student</th>
                    <th style={{ padding: '8px 10px' }}>Current Class & Section</th>
                    <th style={{ padding: '8px 10px' }}>Promote to (Next Class & Sec)</th>
                    <th style={{ padding: '8px 10px' }}>Roll / Admission</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStudents.map((s) => {
                    const sid = s.id || s._id;
                    const isSelected = selectedIds.has(sid);
                    const currentCls = getClassLabel(s);
                    const isGrad = targetClassName === 'Graduated';

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
                        <td style={{ padding: '6px 10px' }}>
                          {currentCls} {s.section ? `(Sec ${s.section})` : ''}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {targetClassName ? (
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
                              {finalTargetClass} {targetYear ? `(${targetYear})` : ''}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#c9664e', fontWeight: 600 }}>
                              ⚠️ Select Class above
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

        {/* REASSURANCE NOTICE */}
        <div style={{ padding: '10px 14px', background: '#eef3f7', borderRadius: '10px', fontSize: '12px', color: '#102d77', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <CheckCircle2 size={18} color="#1237ac" style={{ flexShrink: 0 }} />
          <span>
            New academic history records will be created with the manually selected class and section. Previous academic records and marks remain permanently archived as "Promoted".
          </span>
        </div>

        {/* MODAL ACTIONS */}
        <div className="modal-actions" style={{ margin: 0 }}>
          <button type="button" className="outline-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={loading || selectedIds.size === 0 || !targetClassName.trim()}
            style={{ minWidth: '240px' }}
          >
            <GraduationCap size={16} />
            {loading
              ? 'Promoting...'
              : !targetClassName.trim()
                ? 'Select Next Class & Section'
                : selectedIds.size === activeStudents.length
                  ? `Promote All ${selectedIds.size} to ${finalTargetClass}`
                  : `Promote ${selectedIds.size} Student(s) to ${finalTargetClass}`}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PromoteModal;
