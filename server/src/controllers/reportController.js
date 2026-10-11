const reportService = require('../services/reportService');

class ReportController {
  async getOverview(req, res, next) {
    try {
      const overview = await reportService.getOverview();
      res.status(200).json(overview);
    } catch (err) {
      next(err);
    }
  }

  async getSystemBreakdown(req, res, next) {
    try {
      const breakdown = await reportService.getSystemBreakdown();
      res.status(200).json(breakdown);
    } catch (err) {
      next(err);
    }
  }

  async getTrend(req, res, next) {
    try {
      const { months } = req.query;
      const trend = await reportService.getMonthlyTrend(months);
      res.status(200).json(trend);
    } catch (err) {
      next(err);
    }
  }

  async getFiles(req, res, next) {
    try {
      const files = await reportService.getReportFiles();
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
