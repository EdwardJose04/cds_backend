const express = require('express');
const router = express.Router();
const prestamosController = require('../controllers/prestamos.controllers');

// Generar número de ticket
router.get('/generar-ticket', prestamosController.generarNumeroTicket);

// Crear un nuevo préstamo
router.post('/', prestamosController.crearPrestamo);

// Listar todos los préstamos
router.get('/', prestamosController.listarPrestamos);

// Obtener un préstamo específico
router.get('/:id', prestamosController.obtenerPrestamo);

// Devolver un préstamo
router.put('/:id/devolver', prestamosController.devolverPrestamo);

module.exports = router;