const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors');
const userRoutes = require('./routes/users');
const bodyParser = require('body-parser');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const categoryRoutes = require('./routes/categories');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const saltRounds = 10;  // Number of salt rounds for bcrypt
const nodemailer = require('nodemailer');
require('dotenv').config({ path: './index.env' });  // Specify the path to index.env
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken'); // For creating the remember me token
const cookieParser = require('cookie-parser');
const { checkRememberMe } = require('./middleware');
const session = require('express-session');



const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',        // Your MySQL username
    password: '',        // Your MySQL password
    database: 'fishstoredb'  // Your MySQL database name
});

app.use(express.urlencoded({ extended: true })); // To parse form data

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Define views folder

// Configure session middleware
app.use(
  session({
    secret: 'your_session_secret', // Replace with a secure secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set secure: true if using HTTPS
  })
);


app.use(bodyParser.urlencoded({ extended: false })); // For parsing URL-encoded form data
app.use(bodyParser.json()); // For parsing JSON data
app.use(cookieParser());

// Serve static files (like CSS, JS, images)
app.use(express.static('public'));

app.use(checkRememberMe);



// Other route handlers...

// API route to fetch categories
app.get('/api/categories', (req, res) => {
  const sqlCategories = 'SELECT * FROM categories';
  db.query(sqlCategories, (err, categories) => {
      if (err) {
          console.error('Error fetching categories:', err);
          return res.status(500).send('Internal Server Error');
      }
      res.json(categories); // Send the categories as JSON response
  });
});

// Homepage Route
app.get('/', (req, res) => {
  db.query('SELECT * FROM products LIMIT 6', (err, results) => {
    if (err) {
      return res.status(500).send('Error fetching products');
    }
    res.render('index', { products: results });
  });
});

//Products page Route
// The route for the products page
app.get('/products', (req, res) => {
  const searchQuery = req.query.searchQuery || '';
  const categoryID = req.query.categoryID || '';
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const pageSize = 13; // Number of products per page
  const offset = (page - 1) * pageSize; // Offset calculation

  // Query to fetch categories
  const categoriesSql = 'SELECT * FROM categories';

  // Query to fetch total count of products (for pagination)
  let countSql = 'SELECT COUNT(*) AS total FROM products WHERE 1=1';
  let productsSql = 'SELECT * FROM products WHERE 1=1';
  let queryParams = [];

  // Apply search filters
  if (searchQuery) {
    const searchTerms = searchQuery.toLowerCase().split(/\s+/);
    const searchConditions = searchTerms.map(() => '(LOWER(ProdName) LIKE ? OR LOWER(description) LIKE ?)');
    countSql += ` AND (${searchConditions.join(' AND ')})`;
    productsSql += ` AND (${searchConditions.join(' AND ')})`;

    searchTerms.forEach(term => {
      const wildcardTerm = `%${term}%`;
      queryParams.push(wildcardTerm, wildcardTerm);
    });
  }

  // Apply category filter
  if (categoryID) {
    countSql += ' AND categoryID = ?';
    productsSql += ' AND categoryID = ?';
    queryParams.push(categoryID);
  }

  // Add pagination to the products query
  productsSql += ' LIMIT ? OFFSET ?';
  queryParams.push(pageSize, offset);

  // Fetch categories
  db.query(categoriesSql, (categoriesErr, categories) => {
    if (categoriesErr) {
      console.error(categoriesErr);
      return res.status(500).send('An error occurred while fetching categories.');
    }

    // Fetch the total count of products
    db.query(countSql, queryParams.slice(0, -2), (countErr, countResults) => {
      if (countErr) {
        console.error(countErr);
        return res.status(500).send('An error occurred while counting products.');
      }

      const totalProducts = countResults[0].total;
      const totalPages = Math.ceil(totalProducts / pageSize);

      // Fetch the products
      db.query(productsSql, queryParams, (productsErr, products) => {
        if (productsErr) {
          console.error(productsErr);
          return res.status(500).send('An error occurred while fetching products.');
        }

        // Fetch images for each product
        const productWithImagesPromises = products.map(product => {
          return new Promise((resolve, reject) => {
            const imagesSql = 'SELECT * FROM product_images WHERE ProductID = ?';
            db.query(imagesSql, [product.ProductID], (imagesErr, images) => {
              if (imagesErr) reject(imagesErr);
              else {
                product.images = images || [];
                resolve(product);
              }
            });
          });
        });

        // Wait for all images to be fetched
        Promise.all(productWithImagesPromises)
          .then(productsWithImages => {
            res.render('products', {
              products: productsWithImages,
              categories,
              searchQuery,
              categoryID,
              noMatches: productsWithImages.length === 0,
              currentPage: page,
              totalPages,
            });
          })
          .catch(err => {
            console.error(err);
            res.status(500).send('An error occurred while fetching product images.');
          });
      });
    });
  });
});

// Fetch product details and images
app.get('/products/details/:id', (req, res) => {
  const productId = req.params.id;
  
  const query = `
      SELECT p.ProductID, p.ProdName, p.price, p.description, p.dimensions, 
             pi.ImagePath
      FROM Products p
      LEFT JOIN product_images pi ON p.ProductID = pi.ProductID
      WHERE p.ProductID = ?
  `;
  
  db.query(query, [productId], (err, results) => {
      if (err) {
          console.error('Error retrieving product details:', err);
          return res.status(500).send('Error retrieving product details');
      }

      const product = results[0]; // Product details
      const images = results.map(result => result.ImagePath).filter(Boolean); // Image paths

      // Send product details and images as JSON
      res.json({ product, images });
  });
});



function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
}

// Display Cart Page
// Get Cart Route
app.get('/cart', (req, res) => {
  const cart = req.session.cart || [];

  // If the cart exists, get the products from the database
  if (cart.length > 0) {
    const productIDs = cart.map(item => item.productID);
    const sql = `SELECT * FROM Products WHERE ProductID IN (${productIDs.map(() => '?').join(', ')})`;

    db.query(sql, productIDs, (err, products) => {
      if (err) {
        console.error('Error fetching products from the database:', err);
        return res.status(500).send('An error occurred while fetching cart items.');
      }

      const cartItems = products.map(product => {
        const item = cart.find(cartItem => cartItem.productID === String(product.ProductID));
        return {
          ...product,
          quantity: item ? item.quantity : 0
        };
      });

      const totalPrice = cartItems.reduce((total, item) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity, 10) || 0;
        return total + (price * quantity);
      }, 0);

      res.render('cart', { cartItems, totalPrice });
    });
  } else {
    res.render('cart', { cartItems: [], totalPrice: 0 });
  }
});

// Update Cart Route
app.post('/cart/update', (req, res) => {
  const { productID, quantity } = req.body;

  // Ensure quantity is a valid positive integer
  const parsedQuantity = parseInt(quantity, 10);
  if (!productID || isNaN(parsedQuantity) || parsedQuantity < 0) {
    return res.status(400).send('Invalid productID or quantity');
  }

  // Access the cart from the session
  let cart = req.session.cart || [];

  // Find the existing product in the cart
  const existingProductIndex = cart.findIndex(item => item.productID === productID);

  if (existingProductIndex !== -1) {
    if (parsedQuantity === 0) {
      // Remove the product from the cart if quantity is 0
      cart.splice(existingProductIndex, 1);
    } else {
      // Update the existing product's quantity
      cart[existingProductIndex].quantity = parsedQuantity;
    }
  } else if (parsedQuantity > 0) {
    // Add a new product to the cart if it's not already present
    cart.push({ productID, quantity: parsedQuantity });
  } else {
    return res.status(400).send('Product not found in cart for removal');
  }

  // Save the updated cart in the session
  req.session.cart = cart;

  // If the user has the rememberMe cookie, also store the cart in the cookie
  if (req.cookies.rememberMe) {
    res.cookie('cart', JSON.stringify(cart), { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
  }

  // Log the updated cart for debugging
  console.log("Updated cart:", cart);

  // Redirect to the cart page
  res.redirect('/cart');
});


// Remove Item from Cart
app.post('/cart/remove', (req, res) => {
  const { CartID } = req.body;

  const deleteSql = 'DELETE FROM Cart WHERE CartID = ?';
  db.query(deleteSql, [CartID], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('An error occurred while removing the item from the cart.');
    }

    res.redirect('/cart');
  });
});

// Cart count route
app.get('/cart/count', (req, res) => {
  const userID = req.session.userID;

  if (!userID) {
    return res.json({ count: 0 });
  }

  const cartCountSql = 'SELECT SUM(Quantity) AS count FROM Cart WHERE UserID = ?';
  db.query(cartCountSql, [userID], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('An error occurred while fetching cart count.');
    }

    const cartCount = result[0].count || 0;
    res.json({ count: cartCount });
  });
});

// Serve the registration page
app.get('/register', (req, res) => {
  res.render('register'); // This will render the register.ejs page
});

// Rate limiter to prevent abuse
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many registration attempts. Please try again later.',
});

// Registration route
app.post(
  '/register',
  registerLimiter,
  [
    // Input validation
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password')
      .isStrongPassword({
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
      .withMessage('Password must be strong (min 8 characters, with upper, lower, number, and symbol)'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render('register', { errors: errors.array() }); // Render errors on registration page
    }

    const { name, email, password } = req.body;

    // Check if email is already registered
    const checkEmailSql = 'SELECT Email FROM Users WHERE Email = ?';
    db.query(checkEmailSql, [email], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('A server error occurred. Please try again later.');
      }

      if (results.length > 0) {
        return res.status(400).send('This email is already registered.');
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Generate email verification token
      const verifyToken = crypto.randomBytes(32).toString('hex');
      const verifyUrl = `http://localhost:3000/verify?token=${verifyToken}`;

      const expiresIn = new Date(Date.now() + 3600000);  // Token expires in 1 hour

      // Insert the new user into the database
      const sql =
        'INSERT INTO Users (Name, Email, PasswordHash, VerifyToken, IsVerified, VerifyTokenExpires) VALUES (?, ?, ?, ?, ?, ?)';
      db.query(sql, [name, email, hashedPassword, verifyToken, 0, expiresIn], async (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).send('Error registering user.');
        }

        // Send an email to the owner about the new user
        const ownerEmail = process.env.OWNER_EMAIL;
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: ownerEmail,
          subject: 'New User Registration',
          text: `A new user has signed up:\n\nName: ${name}\nEmail: ${email}`,
        };

        // Send email verification to the user
        const userMailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Verify Your Email',
          text: `Thank you for registering! Please verify your email by clicking the link: ${verifyUrl}`,
        };

        // Nodemailer setup
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        try {
          // Send both emails
          await transporter.sendMail(mailOptions);
          console.log('Owner notification email sent successfully!');
          await transporter.sendMail(userMailOptions);
          console.log('User verification email sent successfully!');
        } catch (error) {
          console.error('Error sending email:', error);
          return res.status(500).send('An error occurred while sending emails.');
        }

        // Redirect to a "check your email" page
        res.render('check-email', {
          message: 'Registration successful! Please verify your email before logging in.',
        });
      });
    });
  }
);

// Render login page (GET request)
app.get('/login', (req, res) => {
  res.render('login'); // Assuming you have a 'login' view to render
});

app.post('/login', (req, res) => {
  const { email, password, rememberMe } = req.body;

  const sql = 'SELECT * FROM Users WHERE Email = ?';
  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Internal server error.');
    }

    if (results.length === 0) {
      return res.status(401).send('Invalid email or password.');
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.PasswordHash);

    if (!isMatch) {
      return res.status(401).send('Invalid email or password.');
    }

    req.session.user = { id: user.UserID, name: user.Name };

    if (rememberMe) {
      // Generate JWT token for rememberMe
      const token = jwt.sign(
        { id: user.UserID, name: user.Name },
        process.env.JWT_SECRET || 'defaultsecret',
        { expiresIn: '30d' } // Token valid for 30 days
      );

      res.cookie('rememberMe', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
    }

    // After login, redirect to cart
    res.redirect('/cart');
  });
});

app.get('/verify', (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).send('Token is required');
  }

  // Find user with the token
  const query = 'SELECT * FROM Users WHERE VerifyToken = ?';
  db.query(query, [token], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Internal server error');
    }

    if (results.length === 0) {
      return res.status(400).send('Invalid token');
    }

    const user = results[0];
    const currentTime = new Date();

    // Check if token is expired
    if (new Date(user.VerifyTokenExpires) < currentTime) {
      return res.status(400).send('Token has expired');
    }

    // If token is valid and not expired, verify the user
    const updateQuery = 'UPDATE Users SET IsVerified = 1 WHERE UserID = ?';
    
    db.query(updateQuery, [user.UserID], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Internal server error');
      }
      res.send('User verified successfully!');
    });
  });
});


app.get('/payment', isAuthenticated, (req, res) => {
  res.render('payment');
});

app.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { error: null, message: null });
});

app.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  const sql = 'SELECT * FROM Users WHERE Email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('A server error occurred. Please try again later.');
    }

    if (results.length === 0) {
      return res.render('forgot-password', { error: 'Email not found.', message: null });
    }

    const user = results[0];
    const passwordResetToken = jwt.sign({ userId: Users.UserID }, 'your_jwt_secret_key', { expiresIn: '1h' });

    const resetLink = `http://yourdomain.com/reset-password/${token}`;
    console.log(`Send email to ${email} with reset link: ${resetLink}`);

    // You'd typically send an email here.
    res.render('forgot-password', { error: null, message: 'Password reset email sent!' });
  });
});

app.get('/reset-password/:token', (req, res) => {
  const { passwordResetToken } = req.params;

  try {
    jwt.verify(token, 'your_jwt_secret_key');
    res.render('reset-password', { token, error: null });
  } catch (err) {
    res.status(400).send('Invalid or expired token.');
  }
});

app.post('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret_key');
    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = 'UPDATE Users SET PasswordHash = ? WHERE UserID = ?';
    db.query(sql, [hashedPassword, decoded.userId], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('A server error occurred. Please try again later.');
      }

      res.send('Password updated successfully! You can now <a href="/login">log in</a>.');
    });
  } catch (err) {
    res.status(400).send('Invalid or expired token.');
  }
});


// Middleware to parse JSON requests
app.use(cors());
app.use(express.json());

// Use user routes
app.use('/api/users', userRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/categories', categoryRoutes);

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});