const jwt = require('jsonwebtoken');
const db = require('./db'); // Ensure this is your database connection
require('dotenv').config({ path: './index.env' });
const express = require('express');
const app = express();
function checkRememberMe(req, res, next) {
  if (req.cookies.rememberMe) {
    // If there's a rememberMe cookie, verify the JWT token
    try {
      const decoded = jwt.verify(req.cookies.rememberMe, process.env.JWT_SECRET || 'defaultsecret');
      req.user = decoded; // Store the user info in the request object
    } catch (err) {
      console.error('Error verifying JWT:', err);
    }
  }
  next();
};


module.exports = { checkRememberMe };
