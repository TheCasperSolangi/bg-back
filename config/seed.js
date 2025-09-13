const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const LedgerBook = require('../models/ledger_schema'); // adjust path if needed

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/entsuki', { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error(err));

async function seedLedger() {
  try {
    // Clear existing data
    await LedgerBook.deleteMany({});

    const customers = [];
    const today = new Date();

    // 4 Customers with Highest Credit Score (mostly paid, future due dates)
    for (let i = 0; i < 4; i++) {
      const mobile = faker.phone.number('03#########');
      for (let j = 0; j < 3; j++) {
        customers.push({
          full_name: faker.person.fullName(),
          mobile_number: mobile,
          order_code: faker.string.uuid(),
          amount_due: faker.number.int({ min: 100, max: 1000 }),
          expected_due_date: faker.date.soon({ days: 30 }).toISOString().split('T')[0],
          is_paid: true,
          paid_on: faker.date.recent({ days: 10 }).toISOString().split('T')[0]
        });
      }
    }

    // 4 Customers with Lowest Credit Score (missed payments, overdue)
    for (let i = 0; i < 4; i++) {
      const mobile = faker.phone.number('03#########');
      for (let j = 0; j < 3; j++) {
        const overdueDays = faker.number.int({ min: 5, max: 60 });
        const pastDate = new Date(today);
        pastDate.setDate(today.getDate() - overdueDays);

        customers.push({
          full_name: faker.person.fullName(),
          mobile_number: mobile,
          order_code: faker.string.uuid(),
          amount_due: faker.number.int({ min: 100, max: 500 }),
          expected_due_date: pastDate.toISOString().split('T')[0],
          is_paid: false
        });
      }
    }

    // 2 Customers with Highest Dues (large unpaid amounts)
    for (let i = 0; i < 2; i++) {
      const mobile = faker.phone.number('03#########');
      for (let j = 0; j < 2; j++) { // fewer orders but very high amount
        customers.push({
          full_name: faker.person.fullName(),
          mobile_number: mobile,
          order_code: faker.string.uuid(),
          amount_due: faker.number.int({ min: 5000, max: 10000 }),
          expected_due_date: faker.date.soon({ days: 15 }).toISOString().split('T')[0],
          is_paid: false
        });
      }
    }

    // Insert all generated customers
    await LedgerBook.insertMany(customers);
    console.log('Ledger seeded with 10 customers successfully!');
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedLedger();