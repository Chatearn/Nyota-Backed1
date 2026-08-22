const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

/*
================================
RAW BODY FOR WEBHOOK SIGNATURE
================================
*/

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

/*
================================
ENVIRONMENT VARIABLES
================================

PAYLOR_API_KEY=your_secret_api_key
PAYLOR_CHANNEL_ID=PAYL-XXXXXX
PAYLOR_WEBHOOK_SECRET=your_webhook_secret
*/

const PAYLOR_API_URL =
    "https://api.paylorke.com/api/v1";

const PAYLOR_API_KEY =
    process.env.PAYLOR_API_KEY;

const PAYLOR_CHANNEL_ID =
    process.env.PAYLOR_CHANNEL_ID;

const PAYLOR_WEBHOOK_SECRET =
    process.env.PAYLOR_WEBHOOK_SECRET;


/*
================================
HOME
================================
*/

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "NYOTA backend is running successfully"
    });
});


/*
================================
PAYLOR CONFIG CHECK
================================
*/

app.get("/api/paylor-config", (req, res) => {

    res.json({
        success: true,

        apiKeyConfigured:
            Boolean(PAYLOR_API_KEY),

        channelConfigured:
            Boolean(PAYLOR_CHANNEL_ID),

        webhookConfigured:
            Boolean(PAYLOR_WEBHOOK_SECRET)
    });
});


/*
================================
FUND OPTIONS
================================
*/

const fundOptions = {
    200: 1
};


/*
================================
APPLICATION
================================
*/

app.post("/api/applications", (req, res) => {

    const {
        fullName,
        idNumber,
        phone,
        county,
        fundAmount
    } = req.body;

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

    const processingFee =
        fundOptions[Number(fundAmount)];

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

        createdAt:
            new Date().toISOString()
    };

    console.log(
        "New application received:",
        application
    );

    res.status(201).json({

        success: true,

        message:
            "Application received successfully.",

        application
    });
});


/*
================================
PHONE NUMBER FORMATTER
================================
*/

function formatPhone(phone) {

    let cleaned =
        String(phone)
            .replace(/\s+/g, "")
            .replace(/-/g, "");

    if (cleaned.startsWith("+254")) {
        cleaned =
            cleaned.substring(1);
    }

    if (cleaned.startsWith("07")) {
        cleaned =
            "254" + cleaned.substring(1);
    }

    if (cleaned.startsWith("01")) {
        cleaned =
            "254" + cleaned.substring(1);
    }

    return cleaned;
}


/*
================================
REAL STK PUSH
================================
*/

app.post("/api/stk-push", async (req, res) => {

    try {

        const {
            phone,
            amount,
            reference
        } = req.body;

        /*
        ----------------------------
        VALIDATION
        ----------------------------
        */

        if (!phone || !amount) {

            return res.status(400).json({

                success: false,

                message:
                    "Phone and amount are required."
            });
        }


        /*
        ----------------------------
        CHECK API KEY
        ----------------------------
        */

        if (!PAYLOR_API_KEY) {

            return res.status(500).json({

                success: false,

                message:
                    "Paylor API key is not configured."
            });
        }


        /*
        ----------------------------
        FORMAT PHONE
        ----------------------------
        */

        const formattedPhone =
            formatPhone(phone);


        /*
        ----------------------------
        VALIDATE KENYAN NUMBER
        ----------------------------
        */

        if (
            !/^254(7|1)\d{8}$/
                .test(formattedPhone)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Enter a valid Kenyan M-Pesa number."
            });
        }


        /*
        ----------------------------
        VALIDATE AMOUNT
        ----------------------------
        */

        const paymentAmount =
            Number(amount);

        if (
            !Number.isInteger(paymentAmount) ||
            paymentAmount <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Amount must be a positive whole number."
            });
        }


        /*
        ----------------------------
        UNIQUE REFERENCE
        ----------------------------
        */

        const paymentReference =
            reference ||
            `NYOTA-${Date.now()}`;


        /*
        ----------------------------
        REQUEST BODY
        ----------------------------
        */

        const paymentData = {

            phone: formattedPhone,

            amount: paymentAmount,

            reference: paymentReference,

            description:
                "NYOTA Payment"

        };


        /*
        ----------------------------
        CHANNEL
        ----------------------------
        */

        if (PAYLOR_CHANNEL_ID) {

            paymentData.channelId =
                PAYLOR_CHANNEL_ID;
        }


        /*
        ----------------------------
        IDEMPOTENCY KEY
        ----------------------------
        */

        const idempotencyKey =
            crypto
                .randomUUID();


        /*
        ----------------------------
        SEND STK PUSH TO PAYLOR
        ----------------------------
        */

        console.log(
            "Sending STK Push:",
            {
                phone: formattedPhone,
                amount: paymentAmount,
                reference: paymentReference
            }
        );


        const response =
            await axios.post(

                `${PAYLOR_API_URL}/merchants/payments/stk-push`,

                paymentData,

                {
                    headers: {

                        Authorization:
                            `Bearer ${PAYLOR_API_KEY}`,

                        "Content-Type":
                            "application/json",

                        "Idempotency-Key":
                            idempotencyKey
                    },

                    timeout: 30000
                }
            );


        /*
        ----------------------------
        PAYLOR RESPONSE
        ----------------------------
        */

        console.log(
            "Paylor response:",
            response.data
        );


        return res.status(200).json({

            success: true,

            message:
                "STK Push sent successfully.",

            transactionId:
                response.data.transactionId,

            status:
                response.data.status,

            reference:
                paymentReference

        });

    } catch (error) {

        console.error(
            "STK PUSH ERROR:"
        );

        if (error.response) {

            console.error(
                error.response.data
            );

            return res.status(
                error.response.status || 500
            ).json({

                success: false,

                message:
                    "Paylor rejected the STK Push request.",

                error:
                    error.response.data
            });
        }


        console.error(
            error.message
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to connect to Paylor.",

            error:
                error.message
        });
    }
});


/*
================================
PAYLOR WEBHOOK
================================
*/

app.post(
    "/api/paylor-callback",
    (req, res) => {

        try {

            const signature =
                req.headers[
                    "x-webhook-signature"
                ];

            if (
                !PAYLOR_WEBHOOK_SECRET
            ) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Webhook secret is not configured."
                });
            }


            const expectedSignature =
                crypto
                    .createHmac(
                        "sha256",
                        PAYLOR_WEBHOOK_SECRET
                    )
                    .update(req.rawBody)
                    .digest("hex");


            /*
            ----------------------------
            VERIFY SIGNATURE
            ----------------------------
            */

            if (
                !signature ||
                signature !== expectedSignature
            ) {

                console.error(
                    "Invalid Paylor webhook signature."
                );

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid webhook signature."
                });
            }


            const {
                event,
                transaction
            } = req.body;


            console.log(
                "PAYLOR WEBHOOK:",
                req.body
            );


            /*
            ----------------------------
            PAYMENT SUCCESS
            ----------------------------
            */

            if (
                event ===
                "payment.success"
            ) {

                console.log(
                    "PAYMENT SUCCESSFUL"
                );

                console.log(
                    "Reference:",
                    transaction.reference
                );

                console.log(
                    "Transaction:",
                    transaction.id
                );

                console.log(
                    "Amount:",
                    transaction.amount
                );

                /*
                Update your database here.

                Example:

                application.status =
                    "paid";
                */
            }


            /*
            ----------------------------
            PAYMENT FAILED
            ----------------------------
            */

            if (
                event ===
                "payment.failed"
            ) {

                console.log(
                    "PAYMENT FAILED"
                );

                console.log(
                    transaction
                );
            }


            return res.json({

                success: true,

                received: true
            });

        } catch (error) {

            console.error(
                "Webhook error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Webhook processing failed."
            });
        }
    }
);


/*
================================
SERVER
================================
*/

app.listen(
    PORT,
    () => {

        console.log(
            `NYOTA backend running on port ${PORT}`
        );
    }
);
