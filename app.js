const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Carga variables de entorno
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas Base
app.use('/api/usuarios', require('./routes/usuarios.routes'));
app.use('/api/herramientas', require('./routes/herramientas.routes'));
/* app.use('/api/productos', require('./routes/productos.routes'));
app.use('/api/prestamos', require('./routes/prestamos.routes'));
app.use('/api/reportes', require('./routes/reportes.routes')); */

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Algo salió mal!' });
});

module.exports = app;