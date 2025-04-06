require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS
}));
app.use(helmet());
app.use(express.json());

// Middleware - Update CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add OPTIONS handler for preflight requests
app.options('*', cors());

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

// Auth Middleware
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('JWT verification error:', err);
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

// Token Generation Endpoint
// Ensure all route paths are properly formatted
app.post('/token', (req, res) => {
    try {
        // Generate token with expiration
        const token = jwt.sign(
            { username: 'api-user' }, 
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({ token });
    } catch (error) {
        console.error('Token generation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Protect existing endpoints with JWT
app.use(authenticateJWT);

let inventory = [];

// Create product
app.post('/products', (req, res) => {
    const product = {
        codigo_producto: req.body.codigo_producto,
        nombre: req.body.nombre,
        marca: req.body.marca,
        descripcion: req.body.descripcion,
        categoria: req.body.categoria,
        genero: req.body.genero,
        notas: req.body.notas,
        proveedor: req.body.proveedor,
        imagenes: [
            req.body.imagen_principal,
            req.body.imagen_secundaria,
            req.body.imagen_terciaria
        ].filter(Boolean),
        etiquetas: req.body.etiquetas,
        tiene_descuento: req.body.tiene_descuento || false,
        porcentaje_descuento: req.body.porcentaje_descuento || 0,
        precio_con_descuento: req.body.precio_con_descuento || null,
        variantes: req.body.variantes.map(variant => ({
            ...variant,
            tiene_descuento: variant.tiene_descuento || false,
            porcentaje_descuento: variant.porcentaje_descuento || 0,
            precio_con_descuento: variant.precio_con_descuento || null
        }))
    };
    inventory.push(product);
    res.status(201).json(product);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});