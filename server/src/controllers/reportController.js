const reportService = require('../services/reportService');

class ReportController {
  async getOverview(req, res, next) {
    try {
      const clinicId = req.user?.clinicId;
      const overview = await reportService.getOverview(clinicId);
      res.status(200).json(overview);
    } catch (err) {
      next(err);
    }
  }

  async getSystemBreakdown(req, res, next) {
    try {
      const clinicId = req.user?.clinicId;
      const breakdown = await reportService.getSystemBreakdown(clinicId);
      res.status(200).json(breakdown);
    } catch (err) {
      next(err);
    }
  }

  async getTrend(req, res, next) {
    try {
      const clinicId = req.user?.clinicId;
      const { months } = req.query;
      const trend = await reportService.getMonthlyTrend(clinicId, months);
      res.status(200).json(trend);
    } catch (err) {
      next(err);
    }
  }

  async getFiles(req, res, next) {
    try {
      const clinicId = req.user?.clinicId;
      const files = await reportService.getReportFiles(clinicId);
      res.status(200).json(files);
    } catch (err) {
      next(err);
    }
  }

  async download(req, res, next) {
    try {
      const clinicId = req.user?.clinicId;
      const fileData = await reportService.getReportDownload(req.params.id, clinicId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
      res.status(200).send(fileData.content);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ detail: err.message, message: err.message });
      }
      next(err);
    }
  }

  async exportMorbidity(req, res, next) {
    try {
      const clinicId = req.user?.clinicId;
      const fileData = await reportService.generateExportCsv(clinicId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
      res.status(200).send(fileData.content);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportController();
