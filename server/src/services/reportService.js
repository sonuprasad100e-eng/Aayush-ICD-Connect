const Report = require('../models/Report');
const AnalyticsSnapshot = require('../models/AnalyticsSnapshot');

class ReportService {
  async getOverview() {
    const latest = await AnalyticsSnapshot.findOne().sort({ createdAt: -1 });

    return {
      totalDiagnoses: latest ? latest.totalDiagnoses : 2856,
      claimsApprovedRate: latest ? latest.claimsApproved : 96,
      claimsRejectedRate: latest ? latest.claimsRejected : 4.2,
      codesMappedYtd: latest ? latest.codesMappedYtd : 1024
    };
  }

  async getSystemBreakdown() {
    const latest = await AnalyticsSnapshot.findOne().sort({ createdAt: -1 });

    const breakdown = latest
      ? latest.systemBreakdown
      : {
          ayurveda: 75.6,
          homeopathy: 40.0,
          yoga: 40.0,
          unani: 11.1,
          siddha: 11.1
        };

    return [
      { system: 'Ayurveda', percentage: breakdown.ayurveda || 75.6, color: 'var(--teal)' },
      { system: 'Homeopathy', percentage: breakdown.homeopathy || 40.0, color: 'var(--navy)' },
      { system: 'Yoga & Naturopathy', percentage: breakdown.yoga || 40.0, color: 'var(--soft-green)' },
      { system: 'Unani', percentage: breakdown.unani || 11.1, color: '#B8860B' },
      { system: 'Siddha', percentage: breakdown.siddha || 11.1, color: 'var(--soft-red)' }
    ];
  }

  async getMonthlyTrend(months = 6) {
    return [
      { month: 'Mar', volume: 40 },
      { month: 'Apr', volume: 55 },
      { month: 'May', volume: 48 },
      { month: 'Jun', volume: 70 },
      { month: 'Jul', volume: 65 },
      { month: 'Aug', volume: 88 }
    ];
  }

  async getReportFiles() {
    const reports = await Report.find().sort({ createdAt: -1 });
    if (reports.length > 0) {
      return reports;
    }

    // Default reports fallback
    return [
      {
        id: 'rep-01',
        name: 'Morbidity Analytics Summary',
        period: 'Aug 2026',
        generatedOn: '16 Aug 2026',
        fileUrl: '/reports/morbidity-summary-aug-2026.pdf',
        type: 'morbidity'
      },
      {
        id: 'rep-02',
        name: 'Insurance Claims Report',
        period: 'Q2 2026',
        generatedOn: '02 Jul 2026',
        fileUrl: '/reports/claims-q2-2026.pdf',
        type: 'claims'
      },
      {
        id: 'rep-03',
        name: 'NAMASTE-ICD Mapping Audit',
        period: 'Jun 2026',
        generatedOn: '30 Jun 2026',
        fileUrl: '/reports/mapping-audit-jun-2026.pdf',
        type: 'mapping-audit'
      }
    ];
  }
}

module.exports = new ReportService();
