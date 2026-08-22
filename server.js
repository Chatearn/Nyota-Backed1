const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

/* =========================================
   MIDDLEWARE
========================================= */

app.use(cors());
app.use(express.json());

/* =========================================
   PAYLOR
========================================= */

const PAYLOR_BASE_URL = "https://api.paylorke.com/api/v1";

/* =========================================
   HOME
========================================= */

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "NYOTA backend is running successfully"
    });
});

/* =========================================
   PAYLOR CONFIG CHECK
========================================= */

app.get("/api/paylor-config", (req, res) => {

    res.json({
        success: true,

        apiKeyConfigured:
            Boolean(process.env.PAYLOR_API_KEY),

        channelConfigured:
            Boolean(process.env.PAYLOR_CHANNEL_ID),

        webhookConfigured:
            Boolean(process.env.PAYLOR_WEBHOOK_SECRET),

        callbackConfigured:
            Boolean(process.env.PAYLOR_CALLBACK_URL)
    });
});

/* =========================================
   FUND OPTIONS
========================================= */

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

/* =========================================
   APPLICATIONS
========================================= */

app.post("/api/applications", (req, res) => {

    try {

        const {
            fullName,
            idNumber,
            phone,
            county,
            fundAmount
        } = req.body;

        /* -----------------------------
           VALIDATION
        ----------------------------- */

        if (
            !fullName ||
            !idNumber ||
            !phone ||
            !county ||
            !fundAmount
        ) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be provided."
            });
        }

        const amount = Number(fundAmount);

        const processingFee =
            fundOptions[amount];

        if (!processingFee) {
            return res.status(400).json({
                success: false,
                message: "Invalid fund amount."
            });
        }

        /* -----------------------------
           APPLICATION ID
        ----------------------------- */

        const applicationId =
            `NYOTA-${Date.now()}`;

        const application = {

            id: applicationId,

            fullName,

            idNumber,

            phone,

            county,

            fundAmount: amount,

            processingFee,

            status: "PENDING",

            paymentStatus: "UNPAID",

            createdAt:
                new Date().toISOString()
        };

        console.log(
            "NEW NYOTA APPLICATION"
        );

        console.log(application);

        return res.status(201).json({

            success: true,

            message:
                "Application received successfully.",

            application
        });

    } catch (error) {

        console.error(
            "APPLICATION ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to process application."
        });
    }
});

/* =========================================
   FORMAT KENYAN PHONE
========================================= */

function formatKenyanPhone(phone) {

    phone = String(phone)
        .trim()
        .replace(/\s+/g, "");

    /* +254712345678 */

    if (phone.startsWith("+254")) {
        phone = phone.substring(1);
    }

    /* 0712345678 */

    if (phone.startsWith("0")) {
        phone =
            "254" +
            phone.substring(1);
    }

    /* 712345678 */

    if (
        phone.length === 9 &&
        (phone.startsWith("7") ||
         phone.startsWith("1"))
    ) {
        phone = "254" + phone;
    }

    return phone;
}

/* =========================================
   STK PUSH
========================================= */

app.post("/api/stkpush", async (req, res) => {

    try {

        let {
            phone,
            amount,
            reference,
            description
        } = req.body;

        /* -----------------------------
           CHECK REQUIRED DATA
        ----------------------------- */

        if (!phone || !amount) {

            return res.status(400).json({

                success: false,

                message:
                    "Phone and amount are required."
            });
        }

        /* -----------------------------
           FORMAT PHONE
        ----------------------------- */

        phone =
            formatKenyanPhone(phone);

        /* -----------------------------
           VALIDATE PHONE
        ----------------------------- */

        if (
            !/^254[17][0-9]{8}$/.test(phone)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Enter a valid Kenyan M-Pesa number."
            });
        }

        /* -----------------------------
           VALIDATE AMOUNT
        ----------------------------- */

        amount = Number(amount);

        if (
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Amount must be a positive whole number."
            });
        }

        /* -----------------------------
           PAYLOR API KEY
        ----------------------------- */

        const apiKey =
            process.env.PAYLOR_API_KEY;

        if (!apiKey) {

            return res.status(500).json({

                success: false,

                message:
                    "PAYLOR_API_KEY is not configured."
            });
        }

        /* -----------------------------
           CHANNEL
        ----------------------------- */

        const channelId =
            process.env.PAYLOR_CHANNEL_ID;

        /* -----------------------------
           REFERENCE
        ----------------------------- */

        if (!reference) {

            reference =
                `NYOTA-${Date.now()}`;
        }

        /* -----------------------------
           IDEMPOTENCY KEY
        ----------------------------- */

        const idempotencyKey =
            crypto.randomUUID();

        /* -----------------------------
           REQUEST BODY
        ----------------------------- */

        const payload = {

            phone,

            amount,

            reference,

            description:
                description ||
                "NYOTA Payment"
        };

        /*
          Only include channelId if configured.
        */

        if (channelId) {
            payload.channelId =
                channelId;
        }

        /*
          Include callback if configured.
        */

        if (
            process.env.PAYLOR_CALLBACK_URL
        ) {

            payload.callbackUrl =
                process.env.PAYLOR_CALLBACK_URL;
        }

        console.log(
            "================================"
        );

        console.log(
            "NYOTA PAYLOR STK PUSH"
        );

        console.log(
            "Phone:",
            phone
        );

        console.log(
            "Amount:",
            amount
        );

        console.log(
            "Reference:",
            reference
        );

        console.log(
            "================================"
        );

        /* -----------------------------
           SEND TO PAYLOR
        ----------------------------- */

        const response =
            await axios.post(

                `${PAYLOR_BASE_URL}/merchants/payments/stk-push`,

                payload,

                {
                    headers: {

                        Authorization:
                            `Bearer ${apiKey}`,

                        "Content-Type":
                            "application/json",

                        "Idempotency-Key":
                            idempotencyKey
                    },

                    timeout: 30000
                }
            );

        console.log(
            "PAYLOR RESPONSE:"
        );

        console.log(
            response.data
        );

        /* -----------------------------
           RETURN RESPONSE
        ----------------------------- */

        return res.status(201).json({

            success: true,

            message:
                "STK Push sent successfully.",

            transactionId:
                response.data.transactionId,

            status:
                response.data.status,

            reference,

            phone,

            amount
        });

    } catch (error) {

        console.error(
            "================================"
        );

        console.error(
            "PAYLOR STK PUSH ERROR"
        );

        console.error(
            error.response?.data ||
            error.message
        );

        console.error(
            "================================"
        );

        return res.status(
            error.response?.status || 500
        ).json({

            success: false,

            message:
                "Failed to send STK Push.",

            error:
                error.response?.data ||
                error.message
        });
    }
});

/* =========================================
   PAYLOR CALLBACK / WEBHOOK
========================================= */

app.post(
    "/api/paylor-callback",
    (req, res) => {

        try {

            console.log(
                "================================"
            );

            console.log(
                "PAYLOR CALLBACK RECEIVED"
            );

            console.log(
                JSON.stringify(
                    req.body,
                    null,
                    2
                )
            );

            console.log(
                "================================"
            );

            /*
             * IMPORTANT:
             *
             * Payment should only be marked
             * successful after validating
             * Paylor's webhook signature.
             */

            const signature =
                req.headers[
                    "x-paylor-signature"
                ];

            console.log(
                "Webhook signature:",
                signature
                    ? "Received"
                    : "Not received"
            );

            /*
             * We acknowledge the webhook.
             */

            return res.status(200).json({

                success: true,

                message:
                    "Callback received."
            });

        } catch (error) {

            console.error(
                "CALLBACK ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Callback processing failed."
            });
        }
    }
);

/* =========================================
   HEALTH CHECK
========================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            server: "online",

            paylor:
                Boolean(
                    process.env.PAYLOR_API_KEY
                ),

            time:
                new Date().toISOString()
        });
    }
);

/* =========================================
   SERVER
========================================= */

app.listen(
    PORT,
    () => {

        console.log(
            "================================"
        );

        console.log(
            "NYOTA BACKEND"
        );

        console.log(
            `Running on port ${PORT}`
        );

        console.log(
            "Paylor:",
            process.env.PAYLOR_API_KEY
                ? "CONFIGURED"
                : "NOT CONFIGURED"
        );

        console.log(
            "================================"
        );
    }
);
