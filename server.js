const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Backend is running successfully"
    });
});

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

app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
