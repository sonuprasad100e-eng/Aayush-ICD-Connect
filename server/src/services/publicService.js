const Patient = require('../models/Patient');
const Mapping = require('../models/Mapping');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

class PublicService {
  async ensureDefaultClinic() {
    try {
      const clinicCount = await Clinic.countDocuments();
      if (clinicCount === 0) {
        const doctor = (await User.findOne({ email: 'doctor@caresync.in' })) || (await User.findOne());
        const defaultClinic = new Clinic({
          clinicName: 'CareSync Ayush Wellness Center',
          doctorName: doctor ? doctor.name : 'Dr. Sonu',
          email: doctor ? doctor.email : 'doctor@caresync.in',
          phone: '+91 98765 43210',
          abhaId: doctor ? (doctor.abhaId || '12-3456-7890-1234') : '12-3456-7890-1234',
          address: '42 Health Park, Sector 5',
          city: 'New Delhi',
          state: 'Delhi',
          pincode: '110001',
          specialization: doctor ? doctor.specialization : 'Ayurveda Physician',
          userId: doctor ? doctor._id : null
        });
        await defaultClinic.save();

        if (doctor) {
          doctor.clinicName = defaultClinic.clinicName;
          doctor.clinicId = defaultClinic._id;
          await doctor.save();
        }
      }
    } catch (err) {
      console.warn('[PublicService] Could not ensure default clinic:', err.message);
    }
  }

  async getStats() {
    await this.ensureDefaultClinic();

    const [patients, mappings, clinics] = await Promise.all([
      Patient.countDocuments({ isDeleted: { $ne: true } }),
      Mapping.countDocuments(),
      Clinic.countDocuments()
    ]);

    return {
      patients,
      mappings,
      clinics
    };
  }
}

module.exports = new PublicService();
