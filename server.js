const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

/*
========================================
HEALTH CHECK
========================================
*/

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "NYOTA backend is running"
    });
});


/*
========================================
FUND OPTIONS
========================================
*/

const fundOptions = {
    "22000": 350,
    "30000": 400,
    "40000": 550,
    "50000": 600,
    "80000": 750,
    "90000": 850,
    "100000": 900,
    "150000": 1500
};


/*
========================================
APPLICATION ENDPOINT
========================================
*/

app.post("/api/applications", (req, res) => {

    try {

        const {
            fullName,
            idNumber,
            phone,
            county,
            fundAmount
        } = req.body;

        if (!fullName || !idNumber || !phone || !county) {
            return res.status(400).json({
                success: false,
                message: "All application fields are required."
            });
        }

        if (!fundAmount || !fundOptions[fundAmount]) {
            return res.status(400).json({
                success: false,
                message: "Invalid fund amount."
            });
        }

        const processingFee = fundOptions[fundAmount];

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

        console.log("NEW APPLICATION:");
        console.log(application);

        res.status(201).json({
            success: true,
            message: "Application received successfully.",
            application
        });

    } catch (error) {

        console.error("Application error:", error);

        res.status(500).json({
            success: false,
            message: "Server error."
        });
    }
});


/*
========================================
START SERVER
========================================
*/

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
