const crypto = require("crypto");
const moment = require("moment");
const querystring = require("qs");
const prisma = require("../prisma/prisma");
const { sortObject } = require("../utils/vnpay.util");

// 1. Tao URL thanh toan VNPay
exports.createVNPayUrl = async (req, res) => {
    try {
        const { order_id, bank_code } = req.body;
        const user_id = Number(req.user.userId);

        if (!order_id) {
            return res.status(400).json({
                success: false,
                message: "order_id is required!"
            });
        }

        const order = await prisma.order.findUnique({
            where: { order_id: Number(order_id) }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found!" });
        }

        if (order.user_id !== user_id && req.user.role?.toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ success: false, message: "Access denied to this order!" });
        }

        const ipAddr = req.headers['x-forwarded-for'] ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            '127.0.0.1';

        const tmnCode = process.env.VNP_TMN_CODE || "2QXUI4J4";
        const secretKey = process.env.VNP_HASH_SECRET || "RAOCTAVBNKHYKWSNMUWUTBDACAWBCNWL";
        let vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        const returnUrl = process.env.VNP_RETURN_URL || "https://tech-store-backend-37qq.onrender.com/api/payments/vnpay-return";

        const date = new Date();
        const createDate = moment(date).format('YYYYMMDDHHmmss');
        const vnpTxnRef = `${order_id}_${moment(date).format('HHmmss')}`;
        const amount = Math.round(Number(order.total_amount) * 100);

        let vnp_Params = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: tmnCode,
            vnp_Locale: 'vn',
            vnp_CurrCode: 'VND',
            vnp_TxnRef: vnpTxnRef,
            vnp_OrderInfo: `Thanh toan don hang #${order_id}`,
            vnp_OrderType: 'other',
            vnp_Amount: amount,
            vnp_ReturnUrl: returnUrl,
            vnp_IpAddr: ipAddr.includes(',') ? ipAddr.split(',')[0].trim() : ipAddr,
            vnp_CreateDate: createDate
        };

        if (bank_code) {
            vnp_Params['vnp_BankCode'] = bank_code;
        }

        vnp_Params = sortObject(vnp_Params);

        const signData = querystring.stringify(vnp_Params, { encode: false });
        const hmac = crypto.createHmac("sha512", secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
        vnp_Params['vnp_SecureHash'] = signed;
        vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

        // Cap nhat vnp_txn_ref vao payment record
        await prisma.payment.updateMany({
            where: { order_id: Number(order_id) },
            data: { vnp_txn_ref: vnpTxnRef }
        });

        return res.status(200).json({
            success: true,
            message: "VNPay payment URL created successfully!",
            payment_url: vnpUrl
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error creating VNPay URL",
            error: error.message
        });
    }
};

// 2. Xu ly ket qua tra ve tu VNPay
exports.vnpayReturn = async (req, res) => {
    try {
        let vnp_Params = req.query;
        const secureHash = vnp_Params['vnp_SecureHash'];

        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        vnp_Params = sortObject(vnp_Params);

        const secretKey = process.env.VNP_HASH_SECRET || "RAOCTAVBNKHYKWSNMUWUTBDACAWBCNWL";
        const signData = querystring.stringify(vnp_Params, { encode: false });
        const hmac = crypto.createHmac("sha512", secretKey);
        const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

        if (secureHash === signed) {
            const order_id = Number(vnp_Params['vnp_TxnRef'].split('_')[0]);
            const responseCode = vnp_Params['vnp_ResponseCode'];

            if (responseCode === "00") {
                await prisma.$transaction(async (tx) => {
                    await tx.payment.updateMany({
                        where: { order_id },
                        data: {
                            status: "completed",
                            paid_at: new Date()
                        }
                    });

                    await tx.order.update({
                        where: { order_id },
                        data: { status: "confirmed" }
                    });
                });

                return res.status(200).json({
                    success: true,
                    message: "Payment processed successfully! Order confirmed.",
                    order_id,
                    transaction_no: vnp_Params['vnp_TransactionNo']
                });
            } else {
                await prisma.payment.updateMany({
                    where: { order_id },
                    data: { status: "failed" }
                });

                return res.status(400).json({
                    success: false,
                    message: "Payment failed or cancelled by user",
                    responseCode
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid checksum signature"
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error processing VNPay return",
            error: error.message
        });
    }
};