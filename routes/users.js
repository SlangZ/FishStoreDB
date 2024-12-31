const express = require('express');
const router = express.Router();
const db = require('../db');

// Route to register a new user
router.post('/register', async (req, res) => {
  const { Name, Email, PasswordHash } = req.body;

  try {
    const [result] = await db.execute(
      'INSERT INTO Users (Name, Email, PasswordHash) VALUES (?, ?, ?)',
      [Name, Email, PasswordHash]
    );
    res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

module.exports = router;
