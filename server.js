const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 10000;

const PAYLOR_BASE_URL =
    "https://api.paylorke.com/api/v1";

/* ================================
   PAYLOR ENVIRONMENT VARIABLES
================================ */

const PAYLOR_API_KEY =
    process.env.PAYLOR_API_KEY;

const PAYLOR_CHANNEL_ID =
    process.env.PAYLOR_CHANNEL_ID;

const BACKEND_URL =
    process.env.BACKEND_URL;

const PAYLOR_WEBHOOK_SECRET =
    process.env.PAYLOR_WEBHOOK_SECRET;


/* ================================
   MIDDLEWARE
================================ */

app.use(cors());

app.use(express.json());


/* ================================
   PAYMENT STORAGE
================================ */

const payments = new Map();


/* ================================
   HOME
================================ */

app.get("/", (req, res) => {

    res.json({
        success: true,
        service: "Business Payment Backend",
        status: "running"
    });

});


/* ================================
   STK PUSH
================================ */

app.post("/stk-push", async (req, res) => {

    try {

        const {
            phone,
            amount,
            reference,
            description
        } = req.body;


        if (!phone) {

            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });

        }


        if (!amount || Number(amount) <= 0) {

            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });

        }


        if (!PAYLOR_API_KEY) {

            return res.status(500).json({
                success: false,
                message: "Paylor API key is not configured"
            });

        }


        if (!PAYLOR_CHANNEL_ID) {

            return res.status(500).json({
                success: false,
                message: "Paylor channel ID is not configured"
            });

        }


        const paymentReference =
            reference ||
            "ORDER-" + Date.now();


        const callbackUrl =
            BACKEND_URL
                ? `${BACKEND_URL}/api/paylor-callback`
                : undefined;


        const payload = {

            phone: String(phone),

            amount: Number(amount),

            reference: paymentReference,

            channelId: PAYLOR_CHANNEL_ID,

            description:
                description ||
                "Business payment"

        };


        if (callbackUrl) {

            payload.callbackUrl =
                callbackUrl;

        }


        console.log(
            "PAYLOR: STK request received",
            {
                phone,
                amount,
                reference: paymentReference
            }
        );


        const response = await fetch(
            `${PAYLOR_BASE_URL}/merchants/payments/stk-push`,
            {

                method: "POST",

                headers: {

                    "Authorization":
                        `Bearer ${PAYLOR_API_KEY}`,

                    "Content-Type":
                        "application/json",

                    "Idempotency-Key":
                        paymentReference

                },

                body:
                    JSON.stringify(payload)

            }
        );


        const data =
            await response.json();


        console.log(
            "PAYLOR RESPONSE:",
            data
        );


        if (!response.ok) {

            return res.status(
                response.status
            ).json({

                success: false,

                message:
                    data.message ||
                    "Paylor STK Push failed",

                data

            });

        }


        const transactionId =
            data.transactionId ||
            data.checkout_request_id;


        payments.set(
            transactionId ||
            paymentReference,
            {

                transactionId,

                reference:
                    paymentReference,

                phone,

                amount:
                    Number(amount),

                status:
                    data.status ||
                    "SENT",

                createdAt:
                    new Date().toISOString()

            }
        );


        return res.json({

            success: true,

            transactionId,

            reference:
                paymentReference,

            status:
                data.status ||
                "SENT",

            message:
                "STK Push sent successfully"

        });


    } catch (error) {

        console.error(
            "STK ERROR:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Unable to initiate payment"

        });

    }

});


/* ================================
   PAYLOR CALLBACK
================================ */

app.post(
    "/api/paylor-callback",
    express.raw({ type: "application/json" }),
    (req, res) => {

        try {

            const signature =
                req.headers["x-paylor-signature"] ||
                req.headers["x-webhook-signature"];


            const rawBody =
                req.body;


            if (
                PAYLOR_WEBHOOK_SECRET &&
                signature
            ) {

                const expected =
                    crypto
                        .createHmac(
                            "sha256",
                            PAYLOR_WEBHOOK_SECRET
                        )
                        .update(rawBody)
                        .digest("hex");


                if (
                    signature !== expected
                ) {

                    console.log(
                        "PAYLOR: Invalid webhook signature"
                    );

                    return res
                        .status(401)
                        .json({
                            success: false,
                            message:
                                "Invalid signature"
                        });

                }

            }


            const payload =
                JSON.parse(
                    rawBody.toString()
                );


            console.log(
                "PAYLOR CALLBACK:",
                payload
            );


            const transactionId =
                payload.transactionId ||
                payload.id;


            const reference =
                payload.reference ||
                payload.merchantReference;


            const payment =
                payments.get(
                    transactionId
                ) ||
                payments.get(
                    reference
                );


            if (payment) {

                payment.status =
                    payload.status ||
                    payment.status;

                payment.callback =
                    payload;

                payment.updatedAt =
                    new Date().toISOString();

            }


            return res.json({
                success: true
            });


        } catch (error) {

            console.error(
                "CALLBACK ERROR:",
                error
            );


            return res.status(400).json({
                success: false
            });

        }

    }
);


/* ================================
   PAYMENT STATUS
================================ */

app.post(
    "/payment-status",
    (req, res) => {

        const {
            transactionId,
            reference
        } = req.body;


        const payment =
            payments.get(
                transactionId
            ) ||
            payments.get(
                reference
            );


        if (!payment) {

            return res.json({

                success: false,

                message:
                    "Payment not found"

            });

        }


        return res.json({

            success: true,

            data: payment

        });

    }
);


/* ================================
   HEALTH CHECK
================================ */

app.get(
    "/health",
    (req, res) => {

        res.json({

            success: true,

            status: "OK",

            paylorConfigured:
                Boolean(
                    PAYLOR_API_KEY &&
                    PAYLOR_CHANNEL_ID
                )

        });

    }
);


/* ================================
   START SERVER
================================ */

app.listen(
    PORT,
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

    }
);
