const { Student, Mark, Attendance } = require('../db');
const { captureAudit } = require('../middleware/audit');
const { toObjectId, serialize, getNextClass, getNextAcademicYear } = require('../utils/helpers');

const getStudentById = async (req, res) => {
  const student = await Student.findById(req.params.id).lean();
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const [marks, attendance] = await Promise.all([
    Mark.find({ studentId: student._id }).populate('classTeacherId', 'name').populate('subjectTeacherId', 'name').populate('teacherId', 'name').lean(),
    Attendance.find({ studentId: student._id }).sort({ date: -1 }).limit(20).lean()
  ]);

  res.json({
    ...serialize(student),
    academicHistory: Array.isArray(student.academicHistory) ? student.academicHistory : [],
    marks: marks.map((mark) => {
      const markYear = mark.academicYear || '2024-2025';
      const matchedHistory = (student.academicHistory || []).find((h) => h.academicYear === markYear);
      const markClass = mark.className || matchedHistory?.className || student.className || '';
      return {
        ...serialize(mark),
        className: markClass,
        academicYear: markYear,
        classTeacher: mark.classTeacherId ? serialize(mark.classTeacherId) : null,
        subjectTeacher: mark.subjectTeacherId ? serialize(mark.subjectTeacherId) : mark.teacherId ? serialize(mark.teacherId) : null
      };
    }),
    attendance: attendance.map((entry) => ({ ...serialize(entry), studentId: entry.studentId.toString() }))
  });
};

const createStudent = async (req, res) => {
  try {
    const firstName = String(req.body.firstName || req.body.first_name || '').trim();
    const lastName = String(req.body.lastName || req.body.last_name || '').trim();
    const admissionNo = String(req.body.admissionNo || req.body.admission_no || '').trim();
    const className = String(req.body.className || req.body.class_name || '').trim();
    const parentMobile = String(req.body.parentMobile || req.body.parent_mobile || '').trim();

    if (!firstName) return res.status(400).json({ error: 'First name is required.' });
    if (!lastName) return res.status(400).json({ error: 'Last name is required.' });
    if (!admissionNo) return res.status(400).json({ error: 'Admission number is required.' });
    if (!className) return res.status(400).json({ error: 'Class name is required.' });
    if (!parentMobile) return res.status(400).json({ error: 'Parent mobile number is required.' });

    const student = await Student.create({
      ...req.body,
      firstName,
      lastName,
      admissionNo,
      className,
      parentMobile,
      rollNumber: req.body.rollNumber !== undefined && req.body.rollNumber !== '' && req.body.rollNumber !== null ? Number(req.body.rollNumber) : null,
      academicYear: req.body.academicYear || '2024-2025',
      status: req.body.status || 'Active',
      parentName: req.body.parentName || '',
      parentEmail: req.body.parentEmail || '',
      grade: req.body.grade || ''
    });
    await captureAudit('create', 'students', student, req.body, req.user);
    res.status(201).json(serialize(student));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A student with this admission number already exists.' });
    }
    console.error('Error creating student:', error);
    res.status(500).json({ error: error.message || 'Failed to create student.' });
  }
};

const updateStudent = async (req, res) => {
  try {
    const parentMobile = String(req.body.parentMobile || req.body.parent_mobile || '').trim();
    if (req.body.parentMobile !== undefined && !parentMobile) {
      return res.status(400).json({ error: 'Parent mobile number is required.' });
    }

    const existing = await Student.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const existingHistory = Array.isArray(existing.academicHistory) ? [...existing.academicHistory] : [];
    const targetYear = req.body.academicYear || existing.academicYear || '2024-2025';
    const targetClass = req.body.className || existing.className || '';

    if (existing.academicYear && existing.academicYear !== targetYear) {
      if (!existingHistory.some((h) => h.academicYear === existing.academicYear)) {
        existingHistory.push({
          academicYear: existing.academicYear,
          className: existing.className || '',
          section: existing.section || '',
          status: 'Completed',
          promotedAt: new Date()
        });
      }
      await Mark.updateMany(
        {
          studentId: existing._id,
          $or: [
            { academicYear: null },
            { academicYear: '' },
            { academicYear: { $exists: false } }
          ]
        },
        { $set: { academicYear: existing.academicYear, className: existing.className } }
      );
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        rollNumber: req.body.rollNumber !== undefined && req.body.rollNumber !== '' && req.body.rollNumber !== null ? Number(req.body.rollNumber) : null,
        academicYear: targetYear,
        className: targetClass,
        status: req.body.status || existing.status || 'Active',
        parentMobile: parentMobile || existing.parentMobile || '',
        parentName: req.body.parentName !== undefined ? req.body.parentName : (existing.parentName || ''),
        parentEmail: req.body.parentEmail !== undefined ? req.body.parentEmail : (existing.parentEmail || ''),
        grade: req.body.grade || '',
        academicHistory: existingHistory
      },
      { new: true }
    );

    if (!student) return res.status(404).json({ error: 'Student not found' });
    await captureAudit('update', 'students', student, req.body, req.user);
    res.json(serialize(student));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A student with this admission number already exists.' });
    }
    console.error('Error updating student:', error);
    res.status(500).json({ error: error.message || 'Failed to update student.' });
  }
};

const promoteStudents = async (req, res) => {
  try {
    const { studentIds, className, allActive, targetYear, scope } = req.body;
    let query = {};
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      query._id = { $in: studentIds.map(toObjectId).filter(Boolean) };
    } else if (className && String(className).trim() && String(className).trim() !== 'all') {
      query.className = String(className).trim();
      query.status = { $ne: 'Graduated' };
    } else if (allActive || scope === 'all') {
      query.status = { $ne: 'Graduated' };
    } else {
      return res.status(400).json({ error: 'Please specify students or class to promote.' });
    }

    const studentsToPromote = await Student.find(query);
    if (!studentsToPromote.length) {
      return res.status(404).json({ error: 'No eligible active students found to promote.' });
    }

    const promotedRecords = [];
    let promotedCount = 0;
    let graduatedCount = 0;

    for (const student of studentsToPromote) {
      const currentClass = student.className || '';
      const currentYear = student.academicYear || '2024-2025';
      const newClass = getNextClass(currentClass);
      const isGraduated = newClass === 'Graduated' || /graduated/i.test(newClass);
      const nextAcademicYear = targetYear || getNextAcademicYear(currentYear);

      // Permanently stamp existing marks before promotion
      await Mark.updateMany(
        {
          studentId: student._id,
          $or: [
            { academicYear: null },
            { academicYear: '' },
            { academicYear: { $exists: false } }
          ]
        },
        { $set: { academicYear: currentYear } }
      );
      await Mark.updateMany(
        {
          studentId: student._id,
          $or: [
            { className: null },
            { className: '' },
            { className: { $exists: false } }
          ]
        },
        { $set: { className: currentClass } }
      );

      const existingHistory = Array.isArray(student.academicHistory) ? [...student.academicHistory] : [];
      if (!existingHistory.some((h) => h.academicYear === currentYear)) {
        existingHistory.push({
          academicYear: currentYear,
          className: currentClass,
          section: student.section || '',
          status: 'Completed',
          promotedAt: new Date()
        });
      }

      const updateData = {
        className: newClass,
        academicYear: nextAcademicYear,
        status: isGraduated ? 'Graduated' : 'Active',
        academicHistory: existingHistory
      };

      const updated = await Student.findByIdAndUpdate(student._id, updateData, { new: true });
      promotedRecords.push(serialize(updated));

      if (isGraduated) {
        graduatedCount++;
      } else {
        promotedCount++;
      }
    }

    await captureAudit('update', 'students', { id: 'bulk-promotion' }, {
      promotedCount,
      graduatedCount,
      targetYear,
      studentCount: studentsToPromote.length
    }, req.user);

    res.json({
      message: `Successfully promoted ${promotedCount} students${graduatedCount > 0 ? ` (${graduatedCount} graduated)` : ''}.`,
      promotedCount,
      graduatedCount,
      total: studentsToPromote.length,
      students: promotedRecords
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getStudentById,
  createStudent,
  updateStudent,
  promoteStudents
};
