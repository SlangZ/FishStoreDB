const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all categories
router.get('/', async (req, res) => {
    try {
        const [categories] = await db.execute('SELECT * FROM Categories');
        res.status(200).json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
});

// Add a new category
router.post('/', async (req, res) => {
    const { CategoryName } = req.body;
    try {
        const [result] = await db.execute(
            'INSERT INTO Categories (CategoryName) VALUES (?)',
            [CategoryName]
        );
        res.status(201).json({ message: 'Category added successfully', categoryId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding category' });
    }
});

module.exports = router;
