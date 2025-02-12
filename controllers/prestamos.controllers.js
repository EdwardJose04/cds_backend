const { promisePool } = require('../config/database');
const jwt = require('jsonwebtoken');

const verificarToken = (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) throw new Error('Token no proporcionado');
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Token inválido');
    }
};

const prestamosController = {
    generarNumeroTicket: async (req, res) => {
        try {
            verificarToken(req);
            
            const [ultimoTicket] = await promisePool.query(`
                SELECT numero_ticket 
                FROM prestamos 
                WHERE DATE(fecha_prestamo) = CURDATE()
                ORDER BY id DESC LIMIT 1
            `);

            const fechaActual = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            let numeroSecuencial = '0001';

            if (ultimoTicket.length > 0) {
                const ultimoNumero = parseInt(ultimoTicket[0].numero_ticket.split('-')[2]) + 1;
                numeroSecuencial = String(ultimoNumero).padStart(4, '0');
            }

            const nuevoTicket = `TICKET-${fechaActual}-${numeroSecuencial}`;
            
            res.status(200).json({ numero_ticket: nuevoTicket });
        } catch (error) {
            console.error('Error al generar número de ticket:', error);
            res.status(500).json({
                message: 'Error al generar número de ticket',
                error: error.message
            });
        }
    },

    crearPrestamo: async (req, res) => {
        const connection = await promisePool.getConnection();
        try {
            await connection.beginTransaction();
            
            const usuarioDecodificado = verificarToken(req);
            const { herramienta_id, cantidad, responsable, lugar_uso, numero_ticket } = req.body;
    
            // Validaciones
            if (!numero_ticket?.trim() || !herramienta_id || !cantidad || !responsable?.trim() || !lugar_uso?.trim()) {
                return res.status(400).json({ 
                    message: 'Todos los campos son obligatorios',
                    receivedData: req.body 
                });
            }

            if (cantidad <= 0) {
                return res.status(400).json({ 
                    message: 'La cantidad debe ser mayor a 0',
                    receivedData: req.body 
                });
            }
    
            // Verificar disponibilidad de la herramienta
            const [herramienta] = await connection.query(
                'SELECT id, cantidad, nombre_herramienta FROM herramientas WHERE id = ?',
                [herramienta_id]
            );
    
            if (herramienta.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Herramienta no encontrada' });
            }

            // Verificar si hay suficiente stock
            if (herramienta[0].cantidad < cantidad) {
                await connection.rollback();
                return res.status(400).json({ 
                    message: `Stock insuficiente. Stock actual: ${herramienta[0].cantidad}` 
                });
            }
    
            // Registrar el préstamo
            const [result] = await connection.query(
                'INSERT INTO prestamos (numero_ticket, herramienta_id, cantidad, responsable, lugar_uso) VALUES (?, ?, ?, ?, ?)',
                [numero_ticket.trim(), herramienta_id, cantidad, responsable.trim(), lugar_uso.trim()]
            );
    
            // Actualizar el stock de la herramienta
            await connection.query(
                'UPDATE herramientas SET cantidad = cantidad - ? WHERE id = ?',
                [cantidad, herramienta_id]
            );

            // Verificar si se agotó el stock
            const [stockActualizado] = await connection.query(
                'SELECT cantidad FROM herramientas WHERE id = ?',
                [herramienta_id]
            );

            if (stockActualizado[0].cantidad === 0) {
                await connection.query(
                    'UPDATE herramientas SET estado = "No disponible" WHERE id = ?',
                    [herramienta_id]
                );
            }
    
            const [nuevoPrestamo] = await connection.query(`
                SELECT p.*, h.nombre_herramienta 
                FROM prestamos p 
                JOIN herramientas h ON p.herramienta_id = h.id 
                WHERE p.id = ?`,
                [result.insertId]
            );

            await connection.commit();
    
            res.status(201).json({
                message: 'Préstamo registrado exitosamente',
                prestamo: nuevoPrestamo[0]
            });
    
        } catch (error) {
            await connection.rollback();
            console.error('Error detallado en crearPrestamo:', error);
            console.error('Stack trace:', error.stack);
            
            res.status(500).json({
                message: 'Error en el registro de préstamo',
                error: error.message,
                details: error.stack,
                receivedData: req.body
            });
        } finally {
            connection.release();
        }
    },

    listarPrestamos: async (req, res) => {
        try {
            verificarToken(req);

            const [prestamos] = await promisePool.query(`
                SELECT p.*, h.nombre_herramienta 
                FROM prestamos p 
                JOIN herramientas h ON p.herramienta_id = h.id
                ORDER BY p.fecha_prestamo DESC
            `);
            
            res.status(200).json(prestamos);
        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al listar préstamos:', error);
            res.status(500).json({
                message: 'Error al listar préstamos',
                error: error.message
            });
        }
    },

    obtenerPrestamo: async (req, res) => {
        try {
            verificarToken(req);
            const { id } = req.params;

            const [prestamos] = await promisePool.query(`
                SELECT p.*, h.nombre_herramienta 
                FROM prestamos p 
                JOIN herramientas h ON p.herramienta_id = h.id 
                WHERE p.id = ?
            `, [id]);

            if (prestamos.length === 0) {
                return res.status(404).json({ message: 'Préstamo no encontrado' });
            }

            res.status(200).json(prestamos[0]);
        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al obtener préstamo:', error);
            res.status(500).json({
                message: 'Error al obtener préstamo',
                error: error.message
            });
        }
    },

    eliminarPrestamo: async (req, res) => {
        const connection = await promisePool.getConnection();
        try {
            await connection.beginTransaction();
            verificarToken(req);
            const { id } = req.params;

            // Obtener información del préstamo
            const [prestamo] = await connection.query(
                'SELECT herramienta_id, cantidad FROM prestamos WHERE id = ?',
                [id]
            );

            if (prestamo.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Préstamo no encontrado' });
            }

            // Actualizar el stock de la herramienta
            await connection.query(
                'UPDATE herramientas SET cantidad = cantidad + ?, estado = "En inventario" WHERE id = ?',
                [prestamo[0].cantidad, prestamo[0].herramienta_id]
            );

            // Eliminar el préstamo
            await connection.query(
                'DELETE FROM prestamos WHERE id = ?',
                [id]
            );

            await connection.commit();

            res.status(200).json({
                message: 'Préstamo eliminado exitosamente'
            });

        } catch (error) {
            await connection.rollback();
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al eliminar préstamo:', error);
            res.status(500).json({
                message: 'Error al eliminar préstamo',
                error: error.message
            });
        } finally {
            connection.release();
        }
    }
};

module.exports = prestamosController;