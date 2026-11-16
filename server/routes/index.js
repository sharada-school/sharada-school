const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');

const authRoutes = require('./authRoutes');
const parentRoutes = require('./parentRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const studentRoutes = require('./studentRoutes');
const teacherRoutes = require('./teacherRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const markRoutes = require('./markRoutes');
const auditRoutes = require('./auditRoutes');

// Health check with DB connection verification
router.get('/health', async (_, res) => {
  const { pool } = require('../db');
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Health check database query failed:', error.message);
    return res.status(503).json({ status: 'unavailable' });
  }
});

// Auth routes (/api/login, /api/register/*, /api/password-reset/*)
router.use('/', authRoutes);

// Parent portal routes (/api/parent/*)
router.use('/parent', parentRoutes);

// Administration & Teacher portal routes (protected with token authentication)
router.use('/dashboard', requireAuth, dashboardRoutes);
router.use('/students', requireAuth, studentRoutes);
router.use('/teachers', requireAuth, teacherRoutes);
router.use('/attendance', requireAuth, attendanceRoutes);
router.use('/marks', requireAuth, markRoutes);
router.use('/audit-logs', requireAuth, auditRoutes);

module.exports = router;
