const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

/* ================================
   HOME
================================ */

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "NYOTA backend is running successfully"
    });
});

/* ================================
   PAYLOR CONFIG CHECK
================================ */

app.get("/api/paylor-config", (req, res) => {
    res.json({
        success: true,
        apiKeyConfigured: Boolean(process.env.PAYLOR_API_KEY),
        channelConfigured: Boolean(process.env.PAYLOR_CHANNEL_ID),
        webhookConfigured: Boolean(process.env.PAYLOR_WEBHOOK_SECRET)
    });
});

/* ================================
   FUND OPTIONS
================================ */

const fundOptions = {
    22000: 350,
    30000: 400,
    40000: 550,
    50000: 600,
    80000: 750,
    90000: 850,
    100000: 900,
    150000: 1500
};

/* ================================
   APPLICATION
================================ */

app.post("/api/applications", (req, res) => {

    const {
        fullName,
        idNumber,
        phone,
        county,
        fundAmount
    } = req.body;

    if (!fullName || !idNumber || !phone || !county || !fundAmount) {
        return res.status(400).json({
            success: false,
            message: "All required fields must be provided."
        });
    }

    const processingFee = fundOptions[fundAmount];

    if (!processingFee) {
        return res.status(400).json({
            success: false,
            message: "Invalid fund amount."
        });
    }

    const application = {
        id: Date.now().toString(),
        fullName,
        idNumber,
        phone,
        county,
        fundAmount: Number(fundAmount),
        processingFee,
        status: "pending",
        createdAt: new Date().toISOString()
    };

    console.log("New application received:");
    console.log(application);

    res.status(201).json({
        success: true,
        message: "Application received successfully.",
        application
    });
});

/* ================================
   TEST STK ENDPOINT
================================ */

app.post("/api/test-stk", (req, res) => {

    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({
            success: false,
            message: "Phone and amount are required."
        });
    }

    const reference =
        "TEST-" + Date.now().toString();

    console.log("TEST STK REQUEST");
    console.log({
        phone,
        amount,
        reference
    });

    res.json({
        success: true,
        testMode: true,
        message: "STK request received successfully.",
        transactionId: reference,
        status: "TEST_SENT"
    });
});

/* ================================
   SERVER
================================ */

app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
