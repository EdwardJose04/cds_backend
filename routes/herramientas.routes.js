const express = require('express');
const router = express.Router();
const herramientasController = require('../controllers/herramientas.controllers');

// Rutas para herramientas
router.post('/', herramientasController.crearHerramienta);
router.get('/', herramientasController.listarHerramientas);
router.get('/:id', herramientasController.obtenerHerramienta);
router.put('/:id', herramientasController.actualizarHerramienta);
router.delete('/:id', herramientasController.eliminarHerramienta);

module.exports = router;