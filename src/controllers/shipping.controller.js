const prisma = require("../prisma/prisma");

// 1. Tinh phi van chuyen dua tren tinh/thanh va tong tien hang
exports.calculateShipping = async (req, res) => {
    try {
        const { province, total_amount = 0 } = req.body;

        if (!province) {
            return res.status(400).json({
                success: false,
                message: "Province is required to calculate shipping fee!"
            });
        }

        const amount = Number(total_amount);
        const provLower = province.toLowerCase();
        const isLocal = provLower.includes("hà nội") || provLower.includes("hồ chí minh") || provLower.includes("ha noi") || provLower.includes("ho chi minh");

        // Bang gia van chuyen
        let standardFee = isLocal ? 30000 : 45000;
        let expressFee = isLocal ? 50000 : 75000;

        // Chinh sach freeship cho don hang >= 5 trieu (doi voi goi standard)
        if (amount >= 5000000) {
            standardFee = 0;
        }

        return res.status(200).json({
            success: true,
            data: {
                province,
                methods: [
                    {
                        code: "standard",
                        name: "Giao hàng tiêu chuẩn",
                        estimated_days: isLocal ? "1 - 2 ngày" : "3 - 5 ngày",
                        fee: standardFee,
                        is_free: standardFee === 0
                    },
                    {
                        code: "express",
                        name: "Giao hàng hỏa tốc",
                        estimated_days: isLocal ? "Trong ngày (4-6 tiếng)" : "1 - 2 ngày",
                        fee: expressFee,
                        is_free: false
                    }
                ]
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error calculating shipping fee",
            error: error.message
        });
    }
};

// 2. Lay danh sach cac don vi van chuyen duoc ho tro (GHTK, GHN, Viettel Post...)
exports.getShippingCarriers = async (req, res) => {
    try {
        const carriers = [
            { code: "GHTK", name: "Giao Hàng Tiết Kiệm", hotline: "1900 6092" },
            { code: "GHN", name: "Giao Hàng Nhanh", hotline: "1900 636677" },
            { code: "VIETTEL_POST", name: "Viettel Post", hotline: "1900 8095" },
            { code: "VNPOST", name: "VNPost / EMS", hotline: "1900 545481" },
            { code: "SPX", name: "SPX Express", hotline: "1900 1221" }
        ];

        return res.status(200).json({
            success: true,
            data: carriers
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching carriers",
            error: error.message
        });
    }
};