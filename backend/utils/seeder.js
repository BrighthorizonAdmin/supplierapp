require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/supplierDB';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  // Inline schema to avoid circular deps
  const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true, lowercase: true },
    password: String,
    role: { type: String, default: 'read-only' },
    isActive: { type: Boolean, default: true },
  }, { timestamps: true });

  const User = mongoose.models.User || mongoose.model('User', userSchema);

  const email = 'admin@supplierapp.com';
  const plainPassword = 'Admin@1234';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`User already exists: ${email}`);
    console.log('Email   :', email);
    console.log('Password: Admin@1234');
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  await User.create({
    name: 'Super Admin',
    email,
    password: hashedPassword,
    role: 'super-admin',
    isActive: true,
  });

  console.log('Super-admin user created successfully!');
  console.log('--------------------------------------');
  console.log('Email   :', email);
  console.log('Password:', plainPassword);
  console.log('Role    : super-admin');
  console.log('--------------------------------------');
  console.log('Login at http://localhost:5001/login');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seeder failed:', err.message);
  process.exit(1);
});
