const express = require('express');
const cors = require('cors');
require('dotenv').config();

// them swagger-ui-express va yamljs de hien thi giao dien swagger
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// load file swagger.yaml tu thu muc goc cua du an
const swaggerDocument = YAML.load(path.join(__dirname, '../swagger.yaml'));

const authRoutes = require('./routes/auth.routes');
const categoryRoutes = require('./routes/category.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// giao dien swagger tai duong dan /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);


app.get('/', (req, res) => {
    res.status(200).json({
        message: "Welcome to Backend Tech Store Ecommerce - Node.js & Prisma!"
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Swagger UI ready at http://localhost:${PORT}/api-docs`);
});