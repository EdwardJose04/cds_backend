const { promisePool } = require('../config/database');
const jwt = require('jsonwebtoken');

const verificarToken = (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        throw new Error('Token no proporcionado');
    }

    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Token inválido');
    }
};

const productosController = {
    crearProducto: async (req, res) => {
        try {
            // Verificar token
            const usuarioDecodificado = verificarToken(req);

            // Solo administradores pueden crear productos
            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({
                    message: 'No tienes permiso para registrar productos'
                });
            }

            const {
                nombre,
                cantidad,
                codigo,
                responsable
            } = req.body;

            // Validaciones básicas
            if (!nombre || !cantidad || !codigo || !responsable) {
                return res.status(400).json({ message: 'Todos los campos son obligatorios' });
            }

            // Verificar si el código ya existe
            const [existingProducts] = await promisePool.query(
                'SELECT * FROM productos WHERE codigo = ?',
                [codigo]
            );

            if (existingProducts.length > 0) {
                return res.status(400).json({
                    message: 'Ya existe un producto con este código'
                });
            }

            // Insertar nuevo producto
            const [result] = await promisePool.query(
                'INSERT INTO productos (nombre, cantidad, codigo, responsable) VALUES (?, ?, ?, ?)',
                [nombre, cantidad, codigo, responsable]
            );

            res.status(201).json({
                message: 'Producto registrado exitosamente',
                productoId: result.insertId
            });

        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error en registro de producto:', error);
            res.status(500).json({
                message: 'Error en el registro de producto',
                error: error.message
            });
        }
    },

    listarProductos: async (req, res) => {
        try {
            // Verificar token
            verificarToken(req);

            const [productos] = await promisePool.query(
                'SELECT * FROM productos'
            );
            res.status(200).json(productos);
        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al listar productos:', error);
            res.status(500).json({
                message: 'Error al listar productos',
                error: error.message
            });
        }
    },

    obtenerProducto: async (req, res) => {
        try {
            // Verificar token
            verificarToken(req);

            const { id } = req.params;
            const [productos] = await promisePool.query(
                'SELECT * FROM productos WHERE id = ?',
                [id]
            );

            if (productos.length === 0) {
                return res.status(404).json({ message: 'Producto no encontrado' });
            }

            res.status(200).json(productos[0]);
        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al obtener producto:', error);
            res.status(500).json({
                message: 'Error al obtener producto',
                error: error.message
            });
        }
    },

    actualizarProducto: async (req, res) => {
        try {
            // Verificar token
            const usuarioDecodificado = verificarToken(req);

            // Solo administradores pueden actualizar productos
            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({
                    message: 'No tienes permiso para actualizar productos'
                });
            }

            const { id } = req.params;
            const {
                nombre,
                cantidad,
                codigo,
                responsable
            } = req.body;

            // Validaciones básicas
            if (!nombre || !cantidad || !codigo || !responsable) {
                return res.status(400).json({ message: 'Todos los campos son obligatorios' });
            }

            // Verificar si el código ya existe en otro producto
            const [existingProducts] = await promisePool.query(
                'SELECT * FROM productos WHERE codigo = ? AND id != ?',
                [codigo, id]
            );

            if (existingProducts.length > 0) {
                return res.status(400).json({
                    message: 'Ya existe otro producto con este código'
                });
            }

            const [result] = await promisePool.query(
                'UPDATE productos SET nombre = ?, cantidad = ?, codigo = ?, responsable = ? WHERE id = ?',
                [nombre, cantidad, codigo, responsable, id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Producto no encontrado' });
            }

            res.status(200).json({
                message: 'Producto actualizado exitosamente',
                producto: { id, nombre, cantidad, codigo, responsable }
            });

        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error en actualización de producto:', error);
            res.status(500).json({
                message: 'Error en la actualización de producto',
                error: error.message
            });
        }
    },

    eliminarProducto: async (req, res) => {
        try {
            // Verificar token
            const usuarioDecodificado = verificarToken(req);

            // Solo administradores pueden eliminar productos
            if (usuarioDecodificado.rol !== 'Administrador') {
                return res.status(403).json({
                    message: 'No tienes permiso para eliminar productos'
                });
            }

            const { id } = req.params;

            const [result] = await promisePool.query(
                'DELETE FROM productos WHERE id = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Producto no encontrado' });
            }

            res.status(200).json({
                message: 'Producto eliminado exitosamente'
            });

        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al eliminar producto:', error);
            res.status(500).json({
                message: 'Error al eliminar producto',
                error: error.message
            });
        }
    }
};

module.exports = productosController;