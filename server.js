// payroll_us_test.js
const axios = require("axios");
require("dotenv").config();

async function main() {
  try {
    console.log("=== Revolut US Payroll Test ===");

    // --- Prefilled test details ---
    const firstName = "Naveed";
    const lastName = "Ahmed";
    const accountNumber = "70580500001951738";
    const routingNumber = "031100209";
    const amount = 250;
    const currency = "USD";
    const reference = "Test Pay June";

    const payload = {
      request_id: "us-" + Date.now(),
      source_account_id: process.env.REVOLUT_BUSINESS_ACCOUNT_ID,
      target: {
        type: "us_account",
        first_name: firstName,
        last_name: lastName,
        account_number: accountNumber,
        routing_number: routingNumber
      },
      amount: amount,
      currency: currency,
      reference: reference
    };

    console.log("\nSending test payroll transfer...");

    const response = await axios.post(
      "https://b2b.revolut.com/api/1.0/transfer",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.REVOLUT_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Test Transfer Response:", response.data);

  } catch (error) {
    if (error.response) {
      console.error("❌ API Error:", error.response.data);
    } else {
      console.error("❌ Error:", error.message);
    }
  }
}

main();
