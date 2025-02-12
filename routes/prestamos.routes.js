const express = require('express');
const router = express.Router();
const prestamosController = require('../controllers/prestamos.controllers');

// Crear un nuevo préstamo
router.post('/', prestamosController.crearPrestamo);

// Listar todos los préstamos
router.get('/', prestamosController.listarPrestamos);

// Generar ticket (corregido)
router.get('/generar-ticket', prestamosController.generarNumeroTicket);

// Obtener un préstamo específico
router.get('/:id', prestamosController.obtenerPrestamo);

// Eliminar un préstamo
router.delete('/:id', prestamosController.eliminarPrestamo);

module.exports = router;