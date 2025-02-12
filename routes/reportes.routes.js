const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controllers');

// Crear un nuevo reporte de salida
router.post('/salidas', reportesController.crearReporteSalida);

// Obtener todos los reportes de salidas
router.get('/salidas', reportesController.listarReportesSalidas);

// Obtener un reporte específico
router.get('/salidas/:id', reportesController.obtenerReporteSalida);

// Obtener reportes por producto
router.get('/salidas/producto/:producto_id', reportesController.obtenerReportesPorProducto);

// Obtener estadísticas
router.get('/estadisticas', reportesController.obtenerEstadisticas);

module.exports = router;