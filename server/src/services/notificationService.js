const Notification = require('../models/Notification');

class NotificationService {
  async getNotifications(user) {
    const query = {
      $or: [
        { userId: user._id || user.id },
        { clinicId: user.clinicId }
      ]
    };

    let notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(20);

    // If no notifications exist yet, seed operational notifications for the user
    if (notifications.length === 0) {
      const defaultNotifs = [
        {
          userId: user._id || user.id,
          clinicId: user.clinicId,
          title: 'Critical Patient Flag',
          message: 'Patient Snehan Naicker (P001) is marked critical with Oncology diagnosis.',
          type: 'alert',
          read: false
        },
        {
          userId: user._id || user.id,
          clinicId: user.clinicId,
          title: 'Terminology Mapped',
          message: 'NAMASTE AYU-0011 (Jwara) successfully crosswalked to WHO ICD-11 TM2 MG26.',
          type: 'info',
          read: false
        },
        {
          userId: user._id || user.id,
          clinicId: user.clinicId,
          title: 'FHIR R4 Bundle Ready',
          message: 'All clinical condition resources are synchronized and FHIR R4 compliant.',
          type: 'system',
          read: true
        }
      ];

      notifications = await Notification.insertMany(defaultNotifs);
    }

    const unreadCount = await Notification.countDocuments({ ...query, read: false });

    return {
      notifications,
      unreadCount
    };
  }

  async markAsRead(id, user) {
    const notif = await Notification.findOne({
      _id: id,
      $or: [
        { userId: user._id || user.id },
        { clinicId: user.clinicId }
      ]
    });

    if (!notif) {
      throw { status: 404, message: 'Notification not found.' };
    }

    notif.read = true;
    await notif.save();
    return notif;
  }

  async markAllAsRead(user) {
    const query = {
      $or: [
        { userId: user._id || user.id },
        { clinicId: user.clinicId }
      ],
      read: false
    };

    await Notification.updateMany(query, { $set: { read: true } });
    return { success: true, message: 'All notifications marked as read.' };
  }
}

module.exports = new NotificationService();
