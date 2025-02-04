const router = require('express').Router();
const usuariosController = require('../controllers/usuarios.controllers');

// Ruta de registro
router.post('/register', usuariosController.registrarUsuario);

// Ruta de login
router.post('/login', usuariosController.login);

// Ruta para listar usuarios
router.get('/', usuariosController.listarUsuarios);

// Ruta para obtener un usuario por ID
router.get('/:id', usuariosController.obtenerUsuario);

// Ruta para actualizar usuario
router.put('/:id', usuariosController.actualizarUsuario);

// Ruta para eliminar usuario
router.delete('/:id', usuariosController.eliminarUsuario);

module.exports = router;