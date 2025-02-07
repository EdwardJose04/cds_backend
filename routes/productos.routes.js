const express = require('express');
const router = express.Router();
const productosController = require('../controllers/productos.controllers');

// Rutas para productos
router.post('/', productosController.crearProducto);
router.get('/', productosController.listarProductos);
router.get('/:id', productosController.obtenerProducto);
router.put('/:id', productosController.actualizarProducto);
router.delete('/:id', productosController.eliminarProducto);

module.exports = router;