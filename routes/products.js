const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all products
router.get('/', async (req, res) => {
    try {
        const [products] = await db.execute('SELECT * FROM Products');
        res.status(200).json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching products' });
    }
});

// Get a single product by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [product] = await db.execute('SELECT * FROM Products WHERE ProductID = ?', [id]);
        if (product.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching product' });
    }
});

// Add a new product
router.post('/', async (req, res) => {
    const { ProdName, categoryID, price, stock, description, image } = req.body;
    try {
        const [result] = await db.execute(
            'INSERT INTO Products (ProdName, categoryID, price, stock, description, image) VALUES (?, ?, ?, ?, ?, ?)',
            [ProdName, categoryID, price, stock, description, image]
        );
        res.status(201).json({ message: 'Product added successfully', productId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding product' });
    }
});

// Update a product
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { ProdName, categoryID, price, stock, description, image } = req.body;
    try {
        const [result] = await db.execute(
            'UPDATE Products SET ProdName = ?, categoryID = ?, price = ?, stock = ?, description = ?, image = ? WHERE ProductID = ?',
            [ProdName, categoryID, price, stock, description, image, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating product' });
    }
});

// Delete a product
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.execute('DELETE FROM Products WHERE ProductID = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting product' });
    }
});

module.exports = router;
