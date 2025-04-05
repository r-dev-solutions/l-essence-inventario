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
app.post('/token', (req, res) => {
    // For simplicity, we'll generate a token for any request
    // In production, you should validate credentials here
    const token = jwt.sign({ username: 'user' }, JWT_SECRET);
    res.json({ token });
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