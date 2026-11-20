const { Student, StudentAcademicHistory, Mark, Attendance } = require('../db');
const { captureAudit } = require('../middleware/audit');
const { toObjectId, serialize, getNextClass, getNextAcademicYear } = require('../utils/helpers');

// Fetch student profile + academic history separately
const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const studentId = student.id || student._id;

    const [academicHistory, marks, attendance] = await Promise.all([
      StudentAcademicHistory.find({ studentId }).sort({ academicYear: -1 }).lean(),
      Mark.find({ studentId })
        .populate('classTeacherId', 'name')
        .populate('subjectTeacherId', 'name')
        .populate('teacherId', 'name')
        .lean(),
      Attendance.find({ studentId }).sort({ date: -1 }).limit(100).lean()
    ]);

    // Format separate Academic History collection
    let formattedHistory = academicHistory.map((h) => ({
      id: h.id || h._id,
      _id: h.id || h._id,
      studentId: studentId.toString(),
      academicYear: h.academicYear,
      class: h.class,
      className: h.section ? `${h.class} ${h.section}`.trim() : h.class,
      section: h.section || '',
      rollNumber: h.rollNumber ? String(h.rollNumber) : '',
      status: h.status || 'Active',
      promotedAt: h.promotedAt || null,
      createdAt: h.createdAt || null
    }));

    // Fallback if empty in table: construct from student profile
    if (!formattedHistory.length) {
      if (Array.isArray(student.academicHistory) && student.academicHistory.length > 0) {
        formattedHistory = student.academicHistory.map((h) => ({
          studentId: studentId.toString(),
          academicYear: h.academicYear,
          class: h.class || h.className || '',
          className: h.section ? `${h.class || h.className} ${h.section}`.trim() : (h.class || h.className),
          section: h.section || '',
          rollNumber: h.rollNumber ? String(h.rollNumber) : '',
          status: h.status || 'Active',
          promotedAt: h.promotedAt || null
        }));
      } else if (student.className) {
        formattedHistory = [{
          studentId: studentId.toString(),
          academicYear: student.academicYear || '2024-2025',
          class: student.className,
          className: student.section ? `${student.className} ${student.section}`.trim() : student.className,
          section: student.section || '',
          rollNumber: student.rollNumber ? String(student.rollNumber) : '',
          status: student.status || 'Active',
          promotedAt: null
        }];
      }
    }

    // Student Profile (Personal Information)
    const profile = {
      _id: studentId,
      id: studentId,
      admissionNumber: student.admissionNumber || student.admissionNo,
      admissionNo: student.admissionNo || student.admissionNumber,
      studentName: student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().slice(0, 10) : '',
      fatherName: student.fatherName || student.parentName || '',
      motherName: student.motherName || '',
      parentName: student.parentName || student.fatherName || '',
      parentMobile: student.parentMobile || '',
      parentEmail: student.parentEmail || '',
      address: student.address || '',
      email: student.email || '',
      phone: student.phone || '',
      status: student.status || 'Active',
      className: student.className || '',
      section: student.section || '',
      rollNumber: student.rollNumber !== null && student.rollNumber !== undefined ? student.rollNumber : null,
      academicYear: student.academicYear || '2024-2025',
      grade: student.grade || '',
      createdAt: student.createdAt
    };

    res.json({
      ...profile,
      academicHistory: formattedHistory,
      marks: marks.map((mark) => {
        const markYear = mark.academicYear || student.academicYear || '2024-2025';
        const matchedHistory = formattedHistory.find((h) => h.academicYear === markYear);
        const markClass = mark.className || matchedHistory?.className || matchedHistory?.class || student.className || '';
        return {
          ...serialize(mark),
          academicRecordId: mark.academicRecordId || matchedHistory?.id || null,
          className: markClass,
          academicYear: markYear,
          classTeacher: mark.classTeacherId ? serialize(mark.classTeacherId) : null,
          subjectTeacher: mark.subjectTeacherId ? serialize(mark.subjectTeacherId) : mark.teacherId ? serialize(mark.teacherId) : null
        };
      }),
      attendance: attendance.map((entry) => ({
        ...serialize(entry),
        studentId: studentId.toString(),
        academicYear: entry.academicYear || student.academicYear || '2024-2025'
      }))
    });
  } catch (err) {
    console.error('Error fetching student details:', err);
    res.status(500).json({ error: 'Failed to retrieve student details.' });
  }
};

// Fetch solely academic history for a student
const getStudentAcademicHistory = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const records = await StudentAcademicHistory.find({ studentId: student.id || student._id })
      .sort({ academicYear: -1 })
      .lean();

    res.json(records.map(serialize));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new student (Student Profile + Initial Academic History)
const createStudent = async (req, res) => {
  try {
    const rawName = String(req.body.studentName || req.body.student_name || '').trim();
    let firstName = String(req.body.firstName || req.body.first_name || '').trim();
    let lastName = String(req.body.lastName || req.body.last_name || '').trim();

    if (!firstName && rawName) {
      const parts = rawName.split(/\s+/);
      firstName = parts[0] || 'Student';
      lastName = parts.slice(1).join(' ') || '.';
    }
    const studentName = rawName || `${firstName} ${lastName}`.trim();

    const admissionNo = String(req.body.admissionNumber || req.body.admissionNo || req.body.admission_no || '').trim();
    const className = String(req.body.className || req.body.class_name || req.body.class || '').trim();
    const parentMobile = String(req.body.parentMobile || req.body.parent_mobile || '').trim();

    if (!firstName) return res.status(400).json({ error: 'Student name / first name is required.' });
    if (!lastName) return res.status(400).json({ error: 'Student last name is required.' });
    if (!admissionNo) return res.status(400).json({ error: 'Admission number is required.' });
    if (!className) return res.status(400).json({ error: 'Class is required.' });
    if (!parentMobile) return res.status(400).json({ error: 'Parent mobile number is required.' });

    const student = await Student.create({
      ...req.body,
      studentName,
      firstName,
      lastName,
      admissionNo,
      admissionNumber: admissionNo,
      dateOfBirth: req.body.dateOfBirth || req.body.date_of_birth || null,
      fatherName: req.body.fatherName || req.body.father_name || req.body.parentName || '',
      motherName: req.body.motherName || req.body.mother_name || '',
      parentName: req.body.parentName || req.body.fatherName || '',
      parentMobile,
      parentEmail: req.body.parentEmail || '',
      address: req.body.address || '',
      email: req.body.email || null,
      phone: req.body.phone || null,
      className,
      section: req.body.section || '',
      rollNumber: req.body.rollNumber !== undefined && req.body.rollNumber !== '' && req.body.rollNumber !== null ? Number(req.body.rollNumber) : null,
      academicYear: req.body.academicYear || '2024-2025',
      status: req.body.status || 'Active',
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

// Update student profile and synchronize current active academic record
const updateStudent = async (req, res) => {
  try {
    const parentMobile = String(req.body.parentMobile || req.body.parent_mobile || '').trim();
    if (req.body.parentMobile !== undefined && !parentMobile) {
      return res.status(400).json({ error: 'Parent mobile number is required.' });
    }

    const existing = await Student.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const targetYear = req.body.academicYear || existing.academicYear || '2024-2025';
    const targetClass = req.body.className || req.body.class || existing.className || '';
    const targetSection = req.body.section !== undefined ? req.body.section : (existing.section || '');
    const targetRoll = req.body.rollNumber !== undefined && req.body.rollNumber !== '' && req.body.rollNumber !== null
      ? Number(req.body.rollNumber)
      : existing.rollNumber;

    // If changing academic year manually via edit, ensure old academic year record exists
    if (existing.academicYear && existing.academicYear !== targetYear) {
      await StudentAcademicHistory.create({
        studentId: existing.id || existing._id,
        academicYear: existing.academicYear,
        class: existing.className || '',
        section: existing.section || '',
        rollNumber: existing.rollNumber !== null ? String(existing.rollNumber) : '',
        status: 'Completed',
        promotedAt: new Date()
      });

      await Mark.updateMany(
        {
          studentId: existing._id || existing.id,
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
        rollNumber: targetRoll,
        academicYear: targetYear,
        className: targetClass,
        section: targetSection,
        status: req.body.status || existing.status || 'Active',
        parentMobile: parentMobile || existing.parentMobile || '',
        parentName: req.body.parentName !== undefined ? req.body.parentName : (existing.parentName || ''),
        parentEmail: req.body.parentEmail !== undefined ? req.body.parentEmail : (existing.parentEmail || ''),
        fatherName: req.body.fatherName !== undefined ? req.body.fatherName : (existing.fatherName || ''),
        motherName: req.body.motherName !== undefined ? req.body.motherName : (existing.motherName || ''),
        address: req.body.address !== undefined ? req.body.address : (existing.address || ''),
        dateOfBirth: req.body.dateOfBirth || req.body.date_of_birth || existing.dateOfBirth,
        grade: req.body.grade || ''
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

// -------------------------------------------------------------
// PROMOTE STUDENTS WORKFLOW
// 1. Select academic year (current -> target)
// 2. Select class & section
// 3. Display student list (select all or individual students)
// 4. Choose next class (mandatory)
// 5. Confirm promotion:
//    - Previous academic records are NEVER deleted; marked as "Promoted"
//    - Marks and attendance stay linked to previous academic year
//    - New academic history records created with "Active" (or "Graduated")
// -------------------------------------------------------------
const promoteStudents = async (req, res) => {
  try {
    const {
      studentIds,
      className,
      allActive,
      sourceYear,
      currentYear,
      targetYear,
      targetClass,
      nextClass,
      targetSection,
      scope
    } = req.body;

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

    const chosenNextClass = String(targetClass || nextClass || '').trim();
    if (!chosenNextClass) {
      return res.status(400).json({ error: 'Selecting the next class is mandatory.' });
    }

    const studentsToPromote = await Student.find(query);
    if (!studentsToPromote.length) {
      return res.status(404).json({ error: 'No eligible active students found to promote.' });
    }

    const promotedRecords = [];
    let promotedCount = 0;
    let graduatedCount = 0;

    for (const student of studentsToPromote) {
      const studentId = student.id || student._id;
      const prevClass = student.className || '';
      const prevSection = student.section || '';
      const prevRollNumber = student.rollNumber !== null && student.rollNumber !== undefined ? String(student.rollNumber) : '';
      const prevYear = currentYear || sourceYear || student.academicYear || '2024-2025';

      const nextAcademicYear = targetYear || getNextAcademicYear(prevYear);
      const targetClassName = req.body.targetClassName || '';
      const chosenTargetClass = req.body.targetClass || req.body.nextClass || '';

      let newClass = String(targetClassName || chosenTargetClass || '').trim();
      if (!newClass || newClass === 'auto') {
        newClass = getNextClass(prevClass);
      }
      const isGraduated = newClass === 'Graduated' || /graduated/i.test(newClass);

      let newSection = '';
      if (!isGraduated) {
        if (targetSection !== undefined && targetSection !== null) {
          newSection = String(targetSection).trim();
        } else {
          const secMatch = newClass.match(/^(.+?)\s+([A-Za-z])$/);
          if (secMatch) {
            newSection = secMatch[2].toUpperCase();
            newClass = secMatch[1].trim();
          } else {
            newSection = prevSection;
          }
        }
      }

      if (!isGraduated && newSection) {
        const trailingSec = new RegExp(`\\s+${newSection}$`, 'i');
        if (trailingSec.test(newClass)) {
          newClass = newClass.replace(trailingSec, '').trim();
        }
      }

      // Step A: Mark previous academic record as Promoted (NEVER delete)
      await StudentAcademicHistory.create({
        studentId,
        academicYear: prevYear,
        class: prevClass,
        section: prevSection,
        rollNumber: prevRollNumber,
        status: 'Promoted',
        promotedAt: new Date()
      });

      // Step B: Permanently lock past marks & attendance to previous academic year
      await Mark.updateMany(
        {
          studentId,
          $or: [
            { academicYear: null },
            { academicYear: '' },
            { academicYear: { $exists: false } }
          ]
        },
        { $set: { academicYear: prevYear, className: prevClass } }
      );

      // Step C: Create NEW Academic History record for next year
      const newAcademicRecord = await StudentAcademicHistory.create({
        studentId,
        academicYear: nextAcademicYear,
        class: newClass,
        section: newSection,
        rollNumber: prevRollNumber,
        status: isGraduated ? 'Graduated' : 'Active'
      });

      // Step D: Update student profile active session pointers
      const updated = await Student.findByIdAndUpdate(studentId, {
        className: newClass,
        section: newSection,
        academicYear: nextAcademicYear,
        status: isGraduated ? 'Graduated' : 'Active'
      }, { new: true });

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
      targetClass: chosenNextClass,
      studentCount: studentsToPromote.length
    }, req.user);

    res.json({
      message: `Successfully promoted ${promotedCount} students to ${chosenNextClass} for ${targetYear}${graduatedCount > 0 ? ` (${graduatedCount} graduated)` : ''}. Previous academic records remain permanently preserved.`,
      promotedCount,
      graduatedCount,
      targetYear,
      targetClass: chosenNextClass,
      total: studentsToPromote.length,
      students: promotedRecords
    });
  } catch (error) {
    console.error('Error promoting students:', error);
    res.status(500).json({ error: error.message || 'Promotion failed.' });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentId = student.id || student._id || id;

    // Delete associated records from marks, attendance, and student_academic_history
    await Promise.all([
      StudentAcademicHistory.deleteMany({ studentId }),
      Mark.deleteMany({ studentId }),
      Attendance.deleteMany({ studentId })
    ]);

    // Delete the student record
    await Student.findByIdAndDelete(studentId);

    // Record audit log
    await captureAudit(
      'delete',
      'students',
      student,
      {
        admissionNo: student.admissionNo || student.admissionNumber,
        studentName: student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        className: student.className
      },
      req.user
    );

    res.json({
      success: true,
      message: 'Student and associated records deleted successfully',
      id: studentId
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: error.message || 'Failed to delete student.' });
  }
};

module.exports = {
  getStudentById,
  getStudentAcademicHistory,
  createStudent,
  updateStudent,
  deleteStudent,
  promoteStudents
};
