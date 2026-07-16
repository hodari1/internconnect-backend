"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
require("../env");
const prisma_1 = __importDefault(require("../services/prisma"));
// GET /api/v1/notifications
const getNotifications = async (req, res) => {
    try {
        const notifications = await prisma_1.default.notification.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: 'desc' }
        });
        const unreadCount = notifications.filter(n => !n.read).length;
        res.json({ unreadCount, notifications });
    }
    catch (error) {
        console.error('getNotifications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getNotifications = getNotifications;
// PUT /api/v1/notifications/:id/read
const markAsRead = async (req, res) => {
    try {
        const notification = await prisma_1.default.notification.findUnique({
            where: { id: req.params.id }
        });
        if (!notification) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        if (notification.userId !== req.user.userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const updated = await prisma_1.default.notification.update({
            where: { id: req.params.id },
            data: { read: true }
        });
        res.json({ message: 'Notification marked as read', notification: updated });
    }
    catch (error) {
        console.error('markAsRead error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.markAsRead = markAsRead;
// PUT /api/v1/notifications/read-all
const markAllAsRead = async (req, res) => {
    try {
        await prisma_1.default.notification.updateMany({
            where: { userId: req.user.userId, read: false },
            data: { read: true }
        });
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        console.error('markAllAsRead error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
exports.markAllAsRead = markAllAsRead;
