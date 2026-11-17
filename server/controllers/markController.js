const { Mark, Student } = require('../db');
const { captureAudit } = require('../middleware/audit');
const { toObjectId, serialize, prepareMark } = require('../utils/helpers');

const getMarks = async (_, res) => {
  const marks = await Mark.find({})
    .sort({ createdAt: -1 })
    .populate('studentId', 'firstName lastName admissionNo className section rollNumber')
    .populate('classTeacherId', 'name')
    .populate('subjectTeacherId', 'name')
    .populate('teacherId', 'name')
    .lean();

  res.json(marks.map((mark) => ({
    ...serialize(mark),
    studentId: mark.studentId ? serialize(mark.studentId) : null,
    classTeacherId: mark.classTeacherId ? serialize(mark.classTeacherId) : null,
    subjectTeacherId: mark.subjectTeacherId ? serialize(mark.subjectTeacherId) : null,
    teacherId: mark.teacherId ? serialize(mark.teacherId) : null,
    className: mark.className || mark.studentId?.className || '',
    academicYear: mark.academicYear || mark.studentId?.academicYear || '2024-2025',
    studentName: mark.studentId ? `${mark.studentId.firstName || ''} ${mark.studentId.lastName || ''}`.trim() : '',
    classTeacherName: mark.classTeacherId ? mark.classTeacherId.name : '',
    subjectTeacherName: mark.subjectTeacherId ? mark.subjectTeacherId.name : mark.teacherId ? mark.teacherId.name : ''
  })));
};

const createMark = async (req, res) => {
  try {
    const studentId = toObjectId(req.body.studentId);
    if (!studentId) {
      return res.status(400).json({ error: 'Please select a valid student.' });
    }

    const subject = String(req.body.subject || '').trim();
    if (!subject) {
      return res.status(400).json({ error: 'Subject is required.' });
    }

    const examType = String(req.body.examType || 'Unit Test').trim();

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'Selected student not found.' });
    }

    const payloadWithDefaults = {
      ...req.body,
      subject,
      examType,
      className: req.body.className || student.className || '',
      academicYear: req.body.academicYear || student.academicYear || '2024-2025'
    };
    const preparedMark = prepareMark(payloadWithDefaults);
    const mark = await Mark.create({
      ...preparedMark,
      studentId,
      teacherId: toObjectId(req.body.teacherId),
      classTeacherId: toObjectId(req.body.classTeacherId),
      subjectTeacherId: toObjectId(req.body.subjectTeacherId || req.body.teacherId),
      grade: req.body.grade || ''
    });
    await captureAudit('create', 'marks', mark, preparedMark, req.user);

    const markId = mark.id || mark._id;
    const populated = markId
      ? await Mark.findById(markId)
          .populate('studentId', 'firstName lastName admissionNo className section academicYear')
          .populate('classTeacherId', 'name')
          .populate('subjectTeacherId', 'name')
          .populate('teacherId', 'name')
      : null;

    const finalDoc = populated || mark;

    res.status(201).json({
      ...serialize(finalDoc),
      studentId: finalDoc.studentId ? serialize(finalDoc.studentId) : null,
      classTeacherId: finalDoc.classTeacherId ? serialize(finalDoc.classTeacherId) : null,
      subjectTeacherId: finalDoc.subjectTeacherId ? serialize(finalDoc.subjectTeacherId) : null,
      teacherId: finalDoc.teacherId ? serialize(finalDoc.teacherId) : null,
      className: finalDoc.className || finalDoc.studentId?.className || student.className || '',
      academicYear: finalDoc.academicYear || finalDoc.studentId?.academicYear || '2024-2025',
      studentName: finalDoc.studentId && typeof finalDoc.studentId === 'object'
        ? `${finalDoc.studentId.firstName || ''} ${finalDoc.studentId.lastName || ''}`.trim()
        : `${student.firstName || ''} ${student.lastName || ''}`.trim(),
      classTeacherName: finalDoc.classTeacherId && typeof finalDoc.classTeacherId === 'object' ? finalDoc.classTeacherId.name : '',
      subjectTeacherName: finalDoc.subjectTeacherId && typeof finalDoc.subjectTeacherId === 'object'
        ? finalDoc.subjectTeacherId.name
        : finalDoc.teacherId && typeof finalDoc.teacherId === 'object' ? finalDoc.teacherId.name : ''
    });
  } catch (error) {
    console.error('Error creating mark:', error);
    res.status(500).json({ error: error.message || 'Failed to save marks.' });
  }
};

const updateMark = async (req, res) => {
  try {
    const studentId = toObjectId(req.body.studentId);
    const preparedMark = prepareMark(req.body);
    const mark = await Mark.findByIdAndUpdate(
      req.params.id,
      {
        ...preparedMark,
        studentId,
        classTeacherId: toObjectId(req.body.classTeacherId),
        subjectTeacherId: toObjectId(req.body.subjectTeacherId || req.body.teacherId),
        grade: req.body.grade || ''
      },
      { new: true }
    );

    if (!mark) return res.status(404).json({ error: 'Mark not found' });
    await captureAudit('update', 'marks', mark, preparedMark, req.user);

    const markId = mark.id || mark._id;
    const populated = markId
      ? await Mark.findById(markId)
          .populate('studentId', 'firstName lastName admissionNo className section academicYear')
          .populate('classTeacherId', 'name')
          .populate('subjectTeacherId', 'name')
          .populate('teacherId', 'name')
      : null;

    const finalDoc = populated || mark;

    res.json({
      ...serialize(finalDoc),
      studentId: finalDoc.studentId ? serialize(finalDoc.studentId) : null,
      classTeacherId: finalDoc.classTeacherId ? serialize(finalDoc.classTeacherId) : null,
      subjectTeacherId: finalDoc.subjectTeacherId ? serialize(finalDoc.subjectTeacherId) : null,
      teacherId: finalDoc.teacherId ? serialize(finalDoc.teacherId) : null,
      className: finalDoc.className || finalDoc.studentId?.className || '',
      academicYear: finalDoc.academicYear || finalDoc.studentId?.academicYear || '2024-2025',
      studentName: finalDoc.studentId && typeof finalDoc.studentId === 'object'
        ? `${finalDoc.studentId.firstName || ''} ${finalDoc.studentId.lastName || ''}`.trim() : '',
      classTeacherName: finalDoc.classTeacherId && typeof finalDoc.classTeacherId === 'object' ? finalDoc.classTeacherId.name : '',
      subjectTeacherName: finalDoc.subjectTeacherId && typeof finalDoc.subjectTeacherId === 'object'
        ? finalDoc.subjectTeacherId.name
        : finalDoc.teacherId && typeof finalDoc.teacherId === 'object' ? finalDoc.teacherId.name : ''
    });
  } catch (error) {
    console.error('Error updating mark:', error);
    res.status(500).json({ error: error.message || 'Failed to update marks.' });
  }
};

const deleteMark = async (req, res) => {
  try {
    const mark = await Mark.findByIdAndDelete(req.params.id);
    if (!mark) return res.status(404).json({ error: 'Mark not found' });
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Error deleting mark:', error);
    res.status(500).json({ error: error.message || 'Failed to delete mark.' });
  }
};

module.exports = {
  getMarks,
  createMark,
  updateMark,
  deleteMark
};
