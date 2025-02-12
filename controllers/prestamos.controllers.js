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
    // Nuevo método para generar número de ticket
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
        try {
            console.log('Datos recibidos:', req.body);
            
            const usuarioDecodificado = verificarToken(req);
            const { herramienta_id, responsable, lugar_uso, numero_ticket } = req.body;
    
            // Validación explícita del numero_ticket
            if (!numero_ticket || numero_ticket.trim() === '') {
                return res.status(400).json({ 
                    message: 'El número de ticket es obligatorio',
                    receivedData: req.body 
                });
            }
    
            // Resto de validaciones
            if (!herramienta_id || !responsable || !lugar_uso) {
                return res.status(400).json({ message: 'Todos los campos son obligatorios' });
            }
    
            // Convertir herramienta_id a número si es necesario
            const herramientaId = parseInt(herramienta_id);
    
            // Verificar disponibilidad de la herramienta
            const [herramienta] = await promisePool.query(
                'SELECT * FROM herramientas WHERE id = ? AND estado = "En inventario"',
                [herramientaId]
            );
    
            if (herramienta.length === 0) {
                return res.status(400).json({ message: 'Herramienta no disponible' });
            }
    
            // Realizar la inserción con valores explícitamente convertidos
            const [result] = await promisePool.query(
                'INSERT INTO prestamos (numero_ticket, herramienta_id, responsable, lugar_uso) VALUES (?, ?, ?, ?)',
                [numero_ticket.trim(), herramientaId, responsable.trim(), lugar_uso.trim()]
            );
    
            // Actualizar estado de la herramienta
            await promisePool.query(
                'UPDATE herramientas SET estado = "En prestamo" WHERE id = ?',
                [herramientaId]
            );
    
            const [nuevoPrestamo] = await promisePool.query(
                'SELECT p.*, h.nombre_herramienta FROM prestamos p JOIN herramientas h ON p.herramienta_id = h.id WHERE p.id = ?',
                [result.insertId]
            );
    
            res.status(201).json({
                message: 'Préstamo registrado exitosamente',
                prestamo: nuevoPrestamo[0]
            });
    
        } catch (error) {
            console.error('Error detallado en crearPrestamo:', error);
            console.error('Stack trace:', error.stack);
            
            // Mejorar el mensaje de error
            res.status(500).json({
                message: 'Error en el registro de préstamo',
                error: error.message,
                details: error.stack,
                receivedData: req.body // Agregar datos recibidos para debugging
            });
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
        try {
            verificarToken(req);
            const { id } = req.params;

            // Verificar que el préstamo existe
            const [prestamo] = await promisePool.query(
                'SELECT * FROM prestamos WHERE id = ?',
                [id]
            );

            if (prestamo.length === 0) {
                return res.status(404).json({ message: 'Préstamo no encontrado' });
            }

            // Actualizar el estado de la herramienta antes de eliminar el préstamo
            await promisePool.query(
                'UPDATE herramientas SET estado = "En inventario" WHERE id = ?',
                [prestamo[0].herramienta_id]
            );

            // Eliminar el préstamo
            await promisePool.query(
                'DELETE FROM prestamos WHERE id = ?',
                [id]
            );

            res.status(200).json({
                message: 'Préstamo eliminado exitosamente'
            });

        } catch (error) {
            if (error.message === 'Token no proporcionado' || error.message === 'Token inválido') {
                return res.status(401).json({ message: error.message });
            }
            console.error('Error al eliminar préstamo:', error);
            res.status(500).json({
                message: 'Error al eliminar préstamo',
                error: error.message
            });
        }
    }
};

module.exports = prestamosController;