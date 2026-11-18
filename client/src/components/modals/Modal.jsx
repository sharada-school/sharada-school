import React, { useState } from 'react';
import { X } from 'lucide-react';
import Field from '../common/Field';
import {
  getClassLabel,
  getStudentByRef,
  getStudentIdValue,
  getStudentOptionLabel,
  attendanceOptions,
  getAttendanceOptionValue
} from '../../utils/formatters';
import {
  examTypes,
  getSubjectParts,
  getMarkRule,
  getConvertedMark
} from '../../utils/grading';

export function Modal({
  type,
  onClose,
  onSave,
  students,
  teachers,
  attendanceItem = null,
  studentItem = null,
  markItem = null,
  teacherItem = null
}) {
  const editingItem = type === 'student' ? studentItem : type === 'mark' ? markItem : type === 'attendance' ? attendanceItem : type === 'teacher' ? teacherItem : null;

  const [form, setForm] = useState(() => {
    if (!editingItem) return {};

    if (type === 'student') {
      return {
        id: editingItem.id,
        admissionNo: editingItem.admissionNumber || editingItem.admissionNo || '',
        admissionNumber: editingItem.admissionNumber || editingItem.admissionNo || '',
        studentName: editingItem.studentName || '',
        firstName: editingItem.firstName || '',
        lastName: editingItem.lastName || '',
        dateOfBirth: editingItem.dateOfBirth ? String(editingItem.dateOfBirth).slice(0, 10) : '',
        fatherName: editingItem.fatherName || editingItem.parentName || '',
        motherName: editingItem.motherName || '',
        address: editingItem.address || '',
        className: editingItem.class || editingItem.className || '',
        section: editingItem.section || '',
        rollNumber: editingItem.rollNumber ?? '',
        email: editingItem.email || '',
        parentName: editingItem.parentName || editingItem.fatherName || '',
        parentMobile: editingItem.parentMobile || '',
        parentEmail: editingItem.parentEmail || '',
        academicYear: editingItem.academicYear || '',
        status: editingItem.status || 'Active',
        grade: editingItem.grade || ''
      };
    }

    if (type === 'mark') {
      const selectedStudent = getStudentByRef(editingItem.studentId, students);
      return {
        id: editingItem.id,
        studentId: selectedStudent ? getStudentIdValue(selectedStudent) : getStudentIdValue(editingItem.studentId),
        classTeacherId: editingItem.classTeacherId && typeof editingItem.classTeacherId === 'object' ? editingItem.classTeacherId.id || editingItem.classTeacherId._id : editingItem.classTeacherId || '',
        subjectTeacherId: editingItem.subjectTeacherId && typeof editingItem.subjectTeacherId === 'object' ? editingItem.subjectTeacherId.id || editingItem.subjectTeacherId._id : editingItem.subjectTeacherId || editingItem.teacherId || '',
        className: selectedStudent ? getClassLabel(selectedStudent) : editingItem.className || '',
        academicYear: editingItem.academicYear || (selectedStudent?.academicYear || '2024-2025'),
        part: editingItem.part || 'Part A',
        subject: editingItem.subject || '',
        examType: editingItem.examType || '',
        score: editingItem.score ?? '',
        maxScore: editingItem.maxScore ?? '',
        oralScore: editingItem.oralScore ?? '',
        convertedScore: editingItem.convertedScore ?? '',
        convertedMaxScore: editingItem.convertedMaxScore ?? '',
        grade: editingItem.grade || ''
      };
    }

    if (type === 'teacher') {
      return {
        id: editingItem.id,
        name: editingItem.name || '',
        email: editingItem.email || ''
      };
    }

    const selectedStudent = getStudentByRef(editingItem.studentId, students);

    return {
      studentId: getStudentIdValue(editingItem.studentId),
      className: editingItem.className || (selectedStudent ? getClassLabel(selectedStudent) : ''),
      date: editingItem.date ? new Date(editingItem.date).toISOString().slice(0, 10) : '',
      status: editingItem.status || '',
      sessionStatus: editingItem.sessionStatus || '',
      attendanceType: editingItem.attendanceType || '',
      remarks: editingItem.remarks || ''
    };
  });

  const set = (key, value) => setForm((previousForm) => ({ ...previousForm, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();

    const normalized = type === 'student'
      ? (() => {
          const { grade: _ignoredGrade, ...rest } = form;
          const fName = String(form.firstName || '').trim();
          const lName = String(form.lastName || '').trim();
          const sName = form.studentName ? String(form.studentName).trim() : `${fName} ${lName}`.trim();
          const adm = String(form.admissionNumber || form.admissionNo || '').trim();
          return {
            ...rest,
            id: studentItem?.id || form.id,
            firstName: fName,
            lastName: lName,
            studentName: sName,
            admissionNo: adm,
            admissionNumber: adm,
            className: form.className || '',
            class: form.className || '',
            section: form.section || '',
            dateOfBirth: form.dateOfBirth || null,
            fatherName: form.fatherName || form.parentName || '',
            motherName: form.motherName || '',
            address: form.address || '',
            parentMobile: form.parentMobile || '',
            parentName: form.parentName || form.fatherName || ''
          };
        })()
      : type === 'mark'
        ? { ...form, id: markItem?.id || form.id }
        : type === 'attendance'
          ? { ...form, id: attendanceItem?.id || form.id, date: form.date || attendanceItem?.date }
          : type === 'teacher'
            ? { ...form, id: teacherItem?.id || form.id }
            : form;

    if (type === 'student') {
      if (!String(normalized.firstName || '').trim()) {
        alert('Please enter student first name.');
        return;
      }
      if (!String(normalized.lastName || '').trim()) {
        alert('Please enter student last name.');
        return;
      }
      if (!String(normalized.admissionNo || '').trim()) {
        alert('Please enter admission number.');
        return;
      }
      if (!String(normalized.className || '').trim()) {
        alert('Please enter class name.');
        return;
      }
      if (!String(normalized.parentMobile || '').trim()) {
        alert('Please enter parent mobile number.');
        return;
      }
    }

    if (type === 'mark') {
      if (!normalized.studentId) {
        alert('Please choose a student before saving marks.');
        return;
      }
      if (!normalized.subject) {
        alert('Please choose a subject before saving marks.');
        return;
      }
      if (!normalized.examType) {
        alert('Please choose an exam type before saving marks.');
        return;
      }
    }

    if (type === 'attendance' && (!normalized.studentId || !normalized.date)) {
      alert('Please choose a student and a date before saving attendance.');
      return;
    }

    onSave(type === 'student' ? 'students' : type === 'teacher' ? 'teachers' : type === 'mark' ? 'marks' : 'attendance', normalized);
  };

  const isEditing = Boolean(editingItem);
  const title = type === 'student' ? (isEditing ? 'Edit student' : 'Add student') : type === 'teacher' ? (isEditing ? 'Edit teacher' : 'Add teacher') : type === 'mark' ? (isEditing ? 'Edit marks' : 'Enter marks') : (isEditing ? 'Edit attendance' : 'Record attendance');

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">QUICK ENTRY</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}><X size={19} /></button>
        </div>

        {type === 'student' ? (
          <>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              1. Student Personal Information
            </div>
            <div className="form-row">
              <Field label="First name" placeholder="First name" value={form.firstName || ''} onChange={(v) => set('firstName', v)} required={true} />
              <Field label="Last name" placeholder="Last name" value={form.lastName || ''} onChange={(v) => set('lastName', v)} required={true} />
            </div>
            <div className="form-row">
              <Field label="Admission number" placeholder="Admission number" value={form.admissionNo || form.admissionNumber || ''} onChange={(v) => { set('admissionNo', v); set('admissionNumber', v); }} required={true} />
              <Field label="Date of birth" type="date" placeholder="Date of birth" value={form.dateOfBirth || ''} onChange={(v) => set('dateOfBirth', v)} required={false} />
            </div>
            <div className="form-row">
              <Field label="Father name" placeholder="Father name" value={form.fatherName || ''} onChange={(v) => { set('fatherName', v); set('parentName', v); }} required={false} />
              <Field label="Mother name" placeholder="Mother name" value={form.motherName || ''} onChange={(v) => set('motherName', v)} required={false} />
            </div>
            <div className="form-row">
              <Field label="Parent mobile number" type="tel" placeholder="Parent mobile number" value={form.parentMobile || ''} onChange={(v) => set('parentMobile', v)} required={true} />
              <Field label="Parent email ID" type="email" placeholder="Parent email ID" value={form.parentEmail || ''} onChange={(v) => set('parentEmail', v)} required={false} />
            </div>
            <div className="form-row">
              <Field label="Address" placeholder="Address" value={form.address || ''} onChange={(v) => set('address', v)} required={false} />
            </div>

            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: '16px', marginBottom: '8px' }}>
              2. Academic Information
            </div>
            <div className="form-row">
              <Field label="Academic Year" placeholder="Academic Year" value={form.academicYear || ''} onChange={(v) => set('academicYear', v)} required={false} />
              <Field label="Class" placeholder="Class" value={form.className || ''} onChange={(v) => set('className', v)} required={true} />
            </div>
            <div className="form-row">
              <Field label="Section" placeholder="Section" value={form.section || ''} onChange={(v) => set('section', v)} required={false} />
              <Field label="Roll number" type="number" placeholder="Roll number" value={form.rollNumber ?? ''} onChange={(v) => set('rollNumber', v)} required={false} />
            </div>
            <div className="form-row">
              <label>
                Status
                <select value={form.status || 'Active'} onChange={(e) => set('status', e.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Graduated">Graduated</option>
                  <option value="Transferred">Transferred</option>
                </select>
              </label>
            </div>
          </>
        ) : type === 'teacher' ? (
          <>
            <Field label="Full name" placeholder="Full name" value={form.name || ''} onChange={(v) => set('name', v)} />
            <Field label="Email" type="email" placeholder="Email" value={form.email || ''} onChange={(v) => set('email', v)} />
          </>
        ) : type === 'mark' ? (
          <>
            <Field label="Academic Year" placeholder="Academic Year" value={form.academicYear || ''} onChange={(v) => set('academicYear', v)} required={false} />
            <select required disabled={isEditing} value={form.className || ''} onChange={(e) => {
              const nextClass = e.target.value;
              set('className', nextClass);
              set('maxScore', getMarkRule(nextClass, form.examType, form.subject).maxScore);
              const sameClassStudents = students.filter((student) => getClassLabel(student) === nextClass);
              if (sameClassStudents.length && (!form.studentId || !sameClassStudents.some((student) => student.id === form.studentId))) {
                set('studentId', sameClassStudents[0].id);
              }
            }}>
              <option value="">Select class</option>
              {Array.from(new Set(students.map((student) => getClassLabel(student)).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map((classOption) => (
                <option value={classOption} key={classOption}>{classOption}</option>
              ))}
            </select>
            <select required disabled={isEditing} value={form.studentId || ''} onChange={(e) => {
              const nextStudentId = e.target.value;
              set('studentId', nextStudentId);
              const nextStudent = students.find((student) => student.id === nextStudentId || student._id === nextStudentId) || null;
              if (nextStudent) set('className', getClassLabel(nextStudent));
            }}>
              <option value="">Select student</option>
              {students.filter((student) => !form.className || getClassLabel(student) === form.className).map((student) => (
                <option value={student.id} key={student.id}>{getStudentOptionLabel(student)}</option>
              ))}
            </select>
            <select value={form.classTeacherId || ''} onChange={(e) => set('classTeacherId', e.target.value)}>
              <option value="">Select class teacher</option>
              {teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}
            </select>
            <select value={form.subjectTeacherId || ''} onChange={(e) => set('subjectTeacherId', e.target.value)}>
              <option value="">Select subject teacher</option>
              {teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.name}</option>)}
            </select>
            <select required value={form.part || ''} onChange={(e) => {
              set('part', e.target.value);
              set('subject', '');
            }}>
              <option value="">Select subject part</option>
              {Object.keys(getSubjectParts(form.className)).map((part) => <option value={part} key={part}>{part}</option>)}
            </select>
            <select required value={form.subject || ''} onChange={(e) => set('subject', e.target.value)}>
              <option value="">Select subject</option>
              {(getSubjectParts(form.className)[form.part] || []).map((subject) => <option value={subject} key={subject}>{subject}</option>)}
            </select>
            <select required value={form.examType || ''} onChange={(e) => {
              const nextExam = e.target.value;
              const rule = getMarkRule(form.className, nextExam, form.subject);
              set('examType', nextExam);
              set('maxScore', rule.maxScore);
              set('convertedMaxScore', rule.convertedMaxScore);
            }}>
              <option value="">Select exam type</option>
              {examTypes.map((exam) => <option value={exam} key={exam}>{exam}</option>)}
            </select>
            {form.part !== 'Part B' && (
              <>
                <Field label={`Obtained marks (out of ${getMarkRule(form.className, form.examType, form.subject).maxScore})`} type="number" value={form.score ?? ''} onChange={(v) => set('score', Number(v))} required />
                {form.examType?.startsWith('SA') && Number.parseInt(String(form.className).match(/\d+/)?.[0] || '', 10) <= 8 && (
                  <Field label="Oral marks (out of 10)" type="number" value={form.oralScore ?? ''} onChange={(v) => set('oralScore', Number(v))} min="0" max="10" required />
                )}
                <div className="mark-preview">Converted marks: {getConvertedMark({ ...form, score: form.score, maxScore: getMarkRule(form.className, form.examType, form.subject).maxScore, convertedScore: undefined })} / {getMarkRule(form.className, form.examType, form.subject).convertedMaxScore}</div>
              </>
            )}
            {form.part === 'Part B' && (
              <label>Grade<select value={form.grade || ''} onChange={(e) => set('grade', e.target.value)} required><option value="">Select grade</option>{['A', 'B', 'C', 'D'].map((grade) => <option value={grade} key={grade}>{grade}</option>)}</select></label>
            )}
          </>
        ) : (
          <>
            <select value={form.className || ''} onChange={(e) => {
              const nextClass = e.target.value;
              set('className', nextClass);
              const sameClassStudents = students.filter((student) => getClassLabel(student) === nextClass);
              if (sameClassStudents.length && (!form.studentId || !sameClassStudents.some((student) => student.id === form.studentId))) {
                set('studentId', sameClassStudents[0].id);
              }
            }} required>
              <option value="">Select class</option>
              {Array.from(new Set(students.map((student) => getClassLabel(student)).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map((classOption) => (
                <option value={classOption} key={classOption}>{classOption}</option>
              ))}
            </select>
            <select value={form.studentId || ''} onChange={(e) => {
              const nextStudentId = e.target.value;
              set('studentId', nextStudentId);
              const nextStudent = students.find((student) => student.id === nextStudentId || student._id === nextStudentId) || null;
              if (nextStudent) set('className', getClassLabel(nextStudent));
            }} required>
              <option value="">Select student</option>
              {students.filter((student) => !form.className || getClassLabel(student) === form.className).map((student) => (
                <option value={student.id} key={student.id}>{getStudentOptionLabel(student)}</option>
              ))}
            </select>
            <Field label="Date" type="date" value={form.date || ''} onChange={(v) => set('date', v)} required />
            <select
              value={getAttendanceOptionValue(form)}
              onChange={(e) => {
                const selected = attendanceOptions.find((option) => option.value === e.target.value);
                if (!selected) return;
                set('status', selected.status);
                set('sessionStatus', selected.sessionStatus);
                set('attendanceType', selected.label);
              }}
              required
            >
              <option value="">Select attendance type</option>
              {attendanceOptions.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
            <Field label="Remarks (optional)" placeholder="Remarks" value={form.remarks || ''} onChange={(v) => set('remarks', v)} required={false} />
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="outline-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button">
            {type === 'student' ? (isEditing ? 'Update student' : 'Create student') : type === 'teacher' ? (isEditing ? 'Update teacher' : 'Create teacher') : type === 'mark' ? (isEditing ? 'Update marks' : 'Submit marks') : (isEditing ? 'Update attendance' : 'Submit attendance')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Modal;
