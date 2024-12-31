const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all orders
router.get('/', async (req, res) => {
    try {
        const [orders] = await db.execute('SELECT * FROM Orders');
        res.status(200).json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching orders' });
    }
});

// Get a single order by ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [order] = await db.execute('SELECT * FROM Orders WHERE OrderID = ?', [id]);
        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(order[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching order' });
    }
});

// Create a new order
router.post('/', async (req, res) => {
    const { UserID, TotalPrice, OrderStatus, ShippingAddress } = req.body;
    try {
        const [result] = await db.execute(
            'INSERT INTO Orders (UserID, TotalPrice, OrderStatus, ShippingAddress) VALUES (?, ?, ?, ?)',
            [UserID, TotalPrice, OrderStatus, ShippingAddress]
        );
        res.status(201).json({ message: 'Order created successfully', orderId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating order' });
    }
});

// Update order status
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { OrderStatus } = req.body;
    try {
        const [result] = await db.execute(
            'UPDATE Orders SET OrderStatus = ? WHERE OrderID = ?',
            [OrderStatus, id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating order' });
    }
});

module.exports = router;
