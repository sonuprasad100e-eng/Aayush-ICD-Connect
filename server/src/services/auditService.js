const AuditLog = require('../models/AuditLog');

class AuditService {
  async log({ userId, clinicId, action, entityType, entityId, details }) {
    try {
      // Ensure passwords, tokens, hashes are never stored in audit logs
      const safeDetails = details ? { ...details } : undefined;
      if (safeDetails) {
        delete safeDetails.password;
        delete safeDetails.passwordHash;
        delete safeDetails.token;
        delete safeDetails.access_token;
        delete safeDetails.JWT_SECRET;
      }

      await AuditLog.create({
        userId,
        clinicId,
        action,
        entityType,
        entityId: entityId ? String(entityId) : undefined,
        details: safeDetails,
        timestamp: new Date()
      });
    } catch (err) {
      console.warn('[AuditService] Logging failed:', err.message);
    }
  }
}

module.exports = new AuditService();
