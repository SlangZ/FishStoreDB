const jwt = require('jsonwebtoken');
const db = require('./db'); // Ensure this is your database connection
require('dotenv').config({ path: './index.env' });
const express = require('express');
const app = express();

function checkRememberMe(req, res, next) {
  console.log("checkRememberMe middleware executed");

  if (req.cookies.rememberMe && !req.session.user) {
    console.log("Remember me cookie found, verifying...");

    try {
      // Verify the JWT token
      const decoded = jwt.verify(
        req.cookies.rememberMe,
        process.env.JWT_SECRET || 'defaultsecret'
      );
      req.session.user = { id: decoded.id, name: decoded.name };

      console.log("JWT verification successful. User ID:", decoded.id);

      // Fetch cart data from the database
      const cartSql = 'SELECT ProductID, Quantity FROM Cart WHERE UserID = ?';

      // Add a timeout fallback
      const timeout = setTimeout(() => {
        console.error("Database query timed out.");
        req.session.cart = []; // Set cart to empty if timeout occurs
        next(); // Proceed to the next middleware
      }, 5000); // Timeout after 5 seconds

      db.query(cartSql, [decoded.id], (cartErr, cartResults) => {
        clearTimeout(timeout); // Clear the timeout once query resolves

        if (cartErr) {
          console.error("Error fetching cart from database:", cartErr);
          req.session.cart = []; // Set cart to empty on error
          return next(); // Continue processing the request
        }

        // Save cart in the session
        req.session.cart = cartResults.map(item => ({
          productID: String(item.ProductID),
          quantity: item.Quantity,
        }));

        console.log("Cart successfully fetched and saved to session.");
        res.locals.user = req.session.user; // Pass user to views
        next(); // Proceed to the next middleware or route handler
      });
    } catch (err) {
      console.error("Error verifying JWT token:", err);
      req.session.user = null; // Clear user session if token is invalid
      res.locals.user = null; // Clear user in views
      next(); // Continue
    }
  } else {
    console.log("No remember me cookie or session user found.");
    res.locals.user = req.session.user; // Pass user to views
    next(); // Continue
  }
}

module.exports = { checkRememberMe };
