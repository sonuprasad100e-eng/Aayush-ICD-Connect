const Report = require('../models/Report');
const AnalyticsSnapshot = require('../models/AnalyticsSnapshot');
const Patient = require('../models/Patient');
const Mapping = require('../models/Mapping');

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
      return reports.map(r => ({
        id: r._id ? r._id.toString() : r.id,
        name: r.name,
        period: r.period,
        generatedOn: r.generatedOn,
        fileUrl: `/api/reports/download/${r._id ? r._id.toString() : r.id}`,
        type: r.type
      }));
    }

    // Default reports fallback
    return [
      {
        id: 'rep-morbidity',
        name: 'Morbidity Analytics Summary',
        period: 'Aug 2026',
        generatedOn: '16 Aug 2026',
        fileUrl: '/api/reports/download/rep-morbidity',
        type: 'morbidity'
      },
      {
        id: 'rep-claims',
        name: 'Insurance Claims Report',
        period: 'Q2 2026',
        generatedOn: '02 Jul 2026',
        fileUrl: '/api/reports/download/rep-claims',
        type: 'claims'
      },
      {
        id: 'rep-mapping',
        name: 'NAMASTE-ICD Mapping Audit',
        period: 'Jun 2026',
        generatedOn: '30 Jun 2026',
        fileUrl: '/api/reports/download/rep-mapping',
        type: 'mapping-audit'
      }
    ];
  }

  async generateExportCsv(clinicId) {
    const query = { isDeleted: false, isArchived: false };
    if (clinicId) query.clinicId = clinicId;

    const patients = await Patient.find(query).sort({ createdAt: -1 });

    const headers = ['Patient Code', 'Name', 'Age', 'Diagnosis', 'NAMASTE Code', 'ICD-11 TM2 Code', 'Status', 'Date Recorded'];
    const rows = patients.map(p => [
      `"${p.patientCode || ''}"`,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.age || 0,
      `"${(p.diagnosisLabel || '').replace(/"/g, '""')}"`,
      `"${p.namasteCode || ''}"`,
      `"${p.icd11Tm2Code || ''}"`,
      `"${p.status || ''}"`,
      `"${p.createdAt ? p.createdAt.toISOString().split('T')[0] : ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    return {
      filename: `CareSync_Morbidity_Export_${new Date().toISOString().split('T')[0]}.csv`,
      content: csvContent
    };
  }

  async getReportDownload(id, clinicId) {
    if (id === 'rep-morbidity' || id.includes('morbidity')) {
      return this.generateExportCsv(clinicId);
    }

    if (id === 'rep-claims' || id.includes('claims')) {
      const headers = ['Claim ID', 'Patient Code', 'AYUSH System', 'Dual-Coded Diagnoses', 'Status', 'Approval Percentage', 'Audit Timestamp'];
      const rows = [
        ['"CLM-001"', '"P001"', '"Ayurveda"', '"AYU-1187 / 2A00"', '"Approved"', '98.5', '"2026-08-10"'],
        ['"CLM-002"', '"P002"', '"Ayurveda"', '"AYU-0568 / 5A11"', '"Approved"', '96.2', '"2026-08-12"'],
        ['"CLM-003"', '"P003"', '"Ayurveda"', '"AYU-0042 / SP70"', '"Approved"', '94.0', '"2026-08-14"'],
        ['"CLM-004"', '"P004"', '"Yoga"', '"AYU-0117 / SP71"', '"Under Review"', '78.0', '"2026-08-15"'],
        ['"CLM-005"', '"P005"', '"Ayurveda"', '"AYU-0093 / SP72"', '"Approved"', '95.8', '"2026-08-15"']
      ];
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      return {
        filename: `CareSync_Insurance_Claims_Report_${new Date().toISOString().split('T')[0]}.csv`,
        content: csv
      };
    }

    // Default: Mapping Audit
    const mappings = await Mapping.find().sort({ confirmedAt: -1 }).limit(100);
    const headers = ['Search Term', 'NAMASTE Code', 'ICD-11 TM2 Code', 'Confidence Score', 'Status', 'Confirmed Date'];
    const rows = mappings.map(m => [
      `"${(m.searchTerm || '').replace(/"/g, '""')}"`,
      `"${m.namasteCode || ''}"`,
      `"${m.icd11Tm2Code || ''}"`,
      `${m.confidenceScore || 0}%`,
      `"${m.status || 'confirmed'}"`,
      `"${m.confirmedAt ? m.confirmedAt.toISOString().split('T')[0] : ''}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    return {
      filename: `CareSync_Mapping_Audit_${new Date().toISOString().split('T')[0]}.csv`,
      content: csv
    };
  }
}

module.exports = new ReportService();
