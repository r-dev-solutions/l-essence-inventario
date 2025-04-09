require('dotenv').config(); // Load environment variables
// Remove the MONGO_URI logging line

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Import cors
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 3001; // Change port to 3001

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS for all routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

// Connect to MongoDB
console.log('Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// Define a Product schema
const productSchema = new mongoose.Schema({
    nombre: String,
    concentracion_alcohol: mongoose.Schema.Types.Mixed,
    precio: Number,
    precio_neto: Number,
    precio_neto_cs: Number,
    codigo: String,
    descripcion: String,
    marca: String,
    genero: {
        type: String,
        enum: ['Masculino', 'Femenino', 'Unisex']
    },
    categoria: String,
    etiquetas: [String],
    tiene_descuento: {
        type: Boolean,
        default: false
    },
    porcentaje_descuento: Number,
    precio_con_descuento: Number,
    stock: Number,
    imagen_primaria: String,
    imagen_secundaria: String,
    imagen_alternativa: String,
    location: String,
    volumen: {
        type: String,
        enum: ['50ml', '75ml', '100ml', '150ml', '200ml'],
        unique: false  // Remove unique constraint
    }
    // Removed presentacion field
});

// Create a Product model
const Product = mongoose.model('Product', productSchema);

// Add compound index for codigo + volumen
Product.collection.createIndex({ codigo: 1, volumen: 1 }, { unique: true });

// POST: Add or update product stock
app.post('/products', async (req, res) => {
    try {
        // Ensure the input is always an array
        const products = Array.isArray(req.body) ? req.body : [req.body];
        const results = [];
        
        // Validate all products first
        for (const product of products) {
            if (!product.codigo || !product.volumen) {
                results.push({
                    status: 'error',
                    message: 'Missing required fields (codigo and volumen are required)',
                    product
                });
            }
        }

        // If any validation errors, return early
        if (results.some(r => r.status === 'error')) {
            return res.status(400).json(results);
        }

        // Process valid products
        const bulkOps = products.map(productData => {
            const { 
                nombre = '', concentracion_alcohol = 0,
                codigo, location = '', 
                precio = 0, precio_neto = 0, precio_neto_cs = 0,
                descripcion = '', marca = '', genero = 'Unisex',
                categoria = '', etiquetas = [], tiene_descuento = false,
                porcentaje_descuento = 0, precio_con_descuento = 0,
                stock = 0,
                imagen_primaria = '', imagen_secundaria = '', imagen_alternativa = ''
            } = productData;

            return {
                updateOne: {
                    filter: { 
                        codigo: productData.codigo,
                        volumen: productData.volumen  // Now using compound key
                    },
                    update: {
                        $set: {
                            nombre,
                            concentracion_alcohol,
                            precio,
                            precio_neto,
                            precio_neto_cs,
                            descripcion,
                            marca,
                            genero,
                            categoria,
                            etiquetas,
                            tiene_descuento,
                            porcentaje_descuento,
                            precio_con_descuento,
                            stock,
                            imagen_primaria,
                            imagen_secundaria,
                            imagen_alternativa,
                            location,
                            volumen: productData.volumen // Ensure volumen is included
                        }
                    },
                    upsert: true
                }
            };
        });

        const bulkResult = await Product.bulkWrite(bulkOps);
        
        res.status(200).json({
            status: 'success',
            insertedCount: bulkResult.upsertedCount,
            modifiedCount: bulkResult.modifiedCount,
            details: bulkResult
        });

    } catch (error) {
        console.error('Error in POST /products:', error);
        if (error.code === 11000) {
            return res.status(400).json({ 
                error: 'Duplicate product',
                details: 'A product with this codigo and volumen combination already exists'
            });
        }
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

// Remove the PUT /products/:codigo/:talla endpoint completely

// GET: Retrieve all products
app.get('/products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.status(200).json(products);
    } catch (error) {
        console.error('Error in GET /products:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// GET: Retrieve a single product by code
app.get('/products/:codigo', async (req, res) => {
    try {
        const product = await Product.findOne({ codigo: req.params.codigo });
        if (product) {
            res.status(200).json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        console.error('Error in GET /products/:codigo:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// PUT: Update product details
app.put('/products/:codigo', async (req, res) => {
    try {
        const product = await Product.findOneAndUpdate(
            { codigo: req.params.codigo },
            req.body,
            { new: true }
        );
        if (product) {
            res.status(200).json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        console.error('Error in PUT /products/:codigo:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// DELETE: Remove a product (keep this version)
app.delete('/products/:codigo', async (req, res) => {
    try {
        const product = await Product.findOneAndDelete({ codigo: req.params.codigo });
        if (product) {
            res.status(200).json({ message: 'Product deleted successfully' });
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        console.error('Error in DELETE /products/:codigo:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Remove this duplicate DELETE route
// DELETE: Remove product by codigo
// app.delete('/products/:codigo', async (req, res) => {
//     const { codigo } = req.params;
//     const result = await Product.deleteOne({ codigo });
//     if (result.deletedCount > 0) {
//         res.status(204).send();
//     } else {
//         res.status(404).send('Product not found');
//     }
// });

// DELETE: Remove all products
app.delete('/products/all', async (req, res) => {
    try {
        console.log('DELETE /products/all request received');
        const result = await Product.deleteMany({});
        console.log('Delete result:', result);
        if (result.deletedCount > 0) {
            res.status(200).send(`${result.deletedCount} products deleted`);
        } else {
            res.status(404).send('No products found to delete');
        }
    } catch (error) {
        console.error('Error in DELETE /products/all:', error);
        res.status(500).send('Error deleting products');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`API listening at http://localhost:${port}`);
});

// PATCH: Update product location
app.patch('/products/location/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const { location } = req.body;

        if (!location) {
            return res.status(400).json({ error: 'Location is required' });
        }

        const product = await Product.findOne({ codigo });
        if (!product) {
            return res.status(404).send('Product not found');
        }

        product.location = location;
        await product.save();
        res.json(product);
    } catch (error) {
        console.error('Error in PATCH /products/location/:codigo:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Security middleware
app.use(helmet());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// JWT verification middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        // Skip logging for public routes
        const publicRoutes = ['/health', '/products', '/products/id/'];
        if (!publicRoutes.some(path => req.path.startsWith(path))) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(400).json({ 
            error: 'Invalid token.',
            details: error.message 
        });
    }
};

// Apply JWT verification to all routes except health check and product by ID
app.use((req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/products/id/')) {
        return next();
    }
    verifyToken(req, res, next);
});

// PUT: Update product by _id - make sure this comes before similar routes
app.put('/products/id/:id', async (req, res) => {
    try {
        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ 
                error: 'Invalid product ID format',
                receivedId: req.params.id,
                expectedFormat: 'MongoDB ObjectId'
            });
        }

        // Remove _id from request body if present to prevent modification attempts
        const updateData = { ...req.body };
        delete updateData._id;
        delete updateData.__v;

        // Special handling for stock - add to existing value
        if (updateData.stock !== undefined) {
            const currentProduct = await Product.findById(req.params.id);
            if (currentProduct) {
                updateData.stock = currentProduct.stock + updateData.stock;
            }
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({ 
                error: 'Product not found',
                details: `No product found with ID: ${req.params.id}`
            });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error('Error in PUT /products/id/:id:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

// Update GET single product endpoint
app.get('/products/:_id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
            return res.status(400).json({ error: 'Invalid product ID format' });
        }
        
        const product = await Product.findById(req.params._id);
        if (product) {
            res.status(200).json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        console.error('Error in GET /products/:_id:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Update PUT endpoint
app.put('/products/:_id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
            return res.status(400).json({ error: 'Invalid product ID format' });
        }

        const product = await Product.findByIdAndUpdate(
            req.params._id,
            req.body,
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error('Error in PUT /products/:_id:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Update DELETE endpoint to use _id
app.delete('/products/id/:id', async (req, res) => {
    try {
        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid product ID format' });
        }

        const product = await Product.findByIdAndDelete(req.params.id);
        if (product) {
            res.status(200).json({ message: 'Product deleted successfully' });
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (error) {
        console.error('Error in DELETE /products/id/:id:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Update PATCH location endpoint
app.patch('/products/location/:_id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params._id)) {
            return res.status(400).json({ error: 'Invalid product ID format' });
        }

        const { location } = req.body;
        if (!location) {
            return res.status(400).json({ error: 'Location is required' });
        }

        const product = await Product.findById(req.params._id);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        product.location = location;
        await product.save();
        res.json(product);
    } catch (error) {
        console.error('Error in PATCH /products/location/:_id:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT: Update stock for a specific presentation
// Elimina este endpoint
// app.put('/products/presentation/:presentationId', async (req, res) => {
//     try {
//         // Validate presentation ID format
//         if (!mongoose.Types.ObjectId.isValid(req.params.presentationId)) {
//             return res.status(400).json({ 
//                 error: 'Invalid presentation ID format',
//                 receivedId: req.params.presentationId,
//                 expectedFormat: 'MongoDB ObjectId'
//             });
//         }
//
//         const { stock } = req.body;
//         if (stock === undefined || typeof stock !== 'number') {
//             return res.status(400).json({ 
//                 error: 'Stock value is required and must be a number'
//             });
//         }
//
//         // Find and update the specific presentation
//         const product = await Product.findOneAndUpdate(
//             { 'presentaciones._id': req.params.presentationId },
//             { $set: { 'presentaciones.$.stock': stock } },
//             { new: true }
//         );
//
//         if (!product) {
//             return res.status(404).json({ 
//                 error: 'Presentation not found',
//                 details: `No presentation found with ID: ${req.params.presentationId}`
//             });
//         }
//
//         // Find the updated presentation
//         const updatedPresentation = product.presentaciones.find(p => 
//             p._id.toString() === req.params.presentationId
//         );
//
//         res.status(200).json({
//             message: 'Stock updated successfully',
//             presentation: updatedPresentation,
//             productId: product._id
//         });
//
//     } catch (error) {
//         console.error('Error in PUT /products/presentation/:presentationId:', error);
//         res.status(500).json({ 
//             error: 'Internal server error', 
//             details: error.message 
//         });
//     }
// });