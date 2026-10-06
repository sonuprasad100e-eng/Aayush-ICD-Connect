class FhirService {
  buildConditionResource(patient) {
    const codings = [
      {
        system: 'http://namaste.ayush.gov.in',
        code: patient.namasteCode,
        display: patient.diagnosisLabel
      },
      {
        system: 'http://id.who.int/icd/release/11/mms',
        code: patient.icd11Tm2Code,
        display: 'Traditional Medicine Module 2 (TM2)'
      }
    ];

    if (patient.icd11BioCode && patient.icd11BioCode.trim() !== '') {
      codings.push({
        system: 'http://id.who.int/icd/release/11/mms',
        code: patient.icd11BioCode,
        display: 'Biomedicine Equivalent'
      });
    }

    return {
      resourceType: 'Condition',
      id: patient.patientCode || patient._id.toString(),
      meta: {
        profile: ['http://hl7.org/fhir/StructureDefinition/Condition'],
        versionId: '1',
        lastUpdated: patient.updatedAt ? patient.updatedAt.toISOString() : new Date().toISOString()
      },
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: patient.status === 'critical' ? 'relapse' : (patient.status === 'review' ? 'recurrence' : 'active'),
            display: patient.status.charAt(0).toUpperCase() + patient.status.slice(1)
          }
        ]
      },
      verificationStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
            code: 'confirmed',
            display: 'Confirmed'
          }
        ]
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'encounter-diagnosis',
              display: 'Encounter Diagnosis'
            }
          ]
        }
      ],
      code: {
        coding: codings,
        text: patient.diagnosisLabel
      },
      subject: {
        reference: `Patient/${patient.patientCode}`,
        display: patient.name
      },
      recordedDate: patient.createdAt ? patient.createdAt.toISOString() : new Date().toISOString()
    };
  }
}

module.exports = new FhirService();
