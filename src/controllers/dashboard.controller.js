const prisma = require("../prisma/prisma");

// 1. Thong ke tong quan Dashboard (Doanh thu, tong don hang, don cho xu ly, so luong user, san pham)
exports.getDashboardStats = async (req, res) => {
    try {
        const [
            totalRevenueResult,
            totalOrders,
            pendingOrders,
            confirmedOrders,
            shippingOrders,
            deliveredOrders,
            cancelledOrders,
            totalUsers,
            customerUsers,
            totalProducts,
            outOfStockProducts,
        ] = await Promise.all([
            // Tong doanh thu cac don hang delivered
            prisma.order.aggregate({
                _sum: {
                    total_amount: true,
                },
                where: {
                    status: "delivered",
                },
            }),
            // Tong so luong don hang
            prisma.order.count(),
            // Don hang cho xu ly (pending)
            prisma.order.count({ where: { status: "pending" } }),
            // Don hang da xac nhan (confirmed)
            prisma.order.count({ where: { status: "confirmed" } }),
            // Don hang dang giao (shipping)
            prisma.order.count({ where: { status: "shipping" } }),
            // Don hang da giao thanh cong (delivered)
            prisma.order.count({ where: { status: "delivered" } }),
            // Don hang da huy (cancelled)
            prisma.order.count({ where: { status: "cancelled" } }),
            // Tong so nguoi dung
            prisma.user.count(),
            // So luong khach hang (Role: CUSTOMER)
            prisma.user.count({ where: { role: "CUSTOMER" } }),
            // Tong so san pham active
            prisma.product.count({ where: { status: "active" } }),
            // So san pham co low stock hoac het hang
            prisma.productVariant.count({ where: { stock: 0 } }),
        ]);

        const totalRevenue = totalRevenueResult._sum.total_amount
            ? Number(totalRevenueResult._sum.total_amount)
            : 0;

        return res.status(200).json({
            success: true,
            data: {
                revenue: {
                    total_revenue: totalRevenue,
                    currency: "VND",
                },
                orders: {
                    total_orders: totalOrders,
                    pending_orders: pendingOrders,
                    confirmed_orders: confirmedOrders,
                    shipping_orders: shippingOrders,
                    delivered_orders: deliveredOrders,
                    cancelled_orders: cancelledOrders,
                },
                users: {
                    total_users: totalUsers,
                    total_customers: customerUsers,
                    total_admins: totalUsers - customerUsers,
                },
                inventory: {
                    total_active_products: totalProducts,
                    out_of_stock_variants: outOfStockProducts,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while fetching dashboard statistics",
            error: error.message,
        });
    }
};

// 2. Top san pham ban chay nhat (dua tren sold_count)
exports.getTopSellingProducts = async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 10;

        const products = await prisma.product.findMany({
            take: limit,
            orderBy: {
                sold_count: "desc",
            },
            include: {
                category: {
                    select: {
                        category_id: true,
                        name: true,
                    },
                },
                variants: {
                    select: {
                        variant_id: true,
                        sku: true,
                        price: true,
                        stock: true,
                    },
                },
            },
        });

        const formattedProducts = products.map((item, index) => ({
            rank: index + 1,
            product_id: item.product_id,
            name: item.name,
            image_url: item.image_url,
            brand: item.brand,
            price: Number(item.price),
            sold_count: item.sold_count,
            rating_avg: Number(item.rating_avg),
            review_count: item.review_count,
            category: item.category ? item.category.name : null,
            total_stock: item.variants.reduce((acc, v) => acc + v.stock, 0),
        }));

        return res.status(200).json({
            success: true,
            limit,
            total_returned: formattedProducts.length,
            data: formattedProducts,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while fetching top selling products",
            error: error.message,
        });
    }
};

// 3. Bieu do doanh thu theo Thang hoac Tuan (revenue chart)
exports.getRevenueChart = async (req, res) => {
    try {
        const period = (req.query.period || "month").toLowerCase(); // 'month' | 'week'
        const currentYear = new Date().getFullYear();
        const selectedYear = Number(req.query.year) || currentYear;

        if (period === "week") {
            // Thong ke theo 7 ngay gan nhat
            const endDate = new Date();
            endDate.setHours(23, 59, 59, 999);

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);

            // Lay cac don hang delivered trong 7 ngay qua
            const orders = await prisma.order.findMany({
                where: {
                    status: "delivered",
                    created_at: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                select: {
                    total_amount: true,
                    created_at: true,
                },
            });

            // Khoi tao du lieu cho 7 ngay
            const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
            const daysData = [];

            for (let i = 0; i < 7; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);

                const dateStr = d.toISOString().split("T")[0]; // YYYY-MM-DD
                const displayDate = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
                const dayName = dayNames[d.getDay()];

                daysData.push({
                    date: dateStr,
                    label: `${dayName} (${displayDate})`,
                    revenue: 0,
                    order_count: 0,
                });
            }

            // Tong hop don hang vao tung ngay
            let totalPeriodRevenue = 0;
            let totalPeriodOrders = 0;

            orders.forEach((order) => {
                const orderDateStr = order.created_at.toISOString().split("T")[0];
                const dayItem = daysData.find((d) => d.date === orderDateStr);
                if (dayItem) {
                    const amount = Number(order.total_amount);
                    dayItem.revenue += amount;
                    dayItem.order_count += 1;
                    totalPeriodRevenue += amount;
                    totalPeriodOrders += 1;
                }
            });

            return res.status(200).json({
                success: true,
                period: "week",
                range: {
                    from: startDate.toISOString().split("T")[0],
                    to: endDate.toISOString().split("T")[0],
                },
                summary: {
                    total_revenue: totalPeriodRevenue,
                    total_orders: totalPeriodOrders,
                },
                chart_data: daysData,
            });
        }

        // Mac dinh: Thong ke theo 12 thang trong nam
        const startOfYear = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
        const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

        const orders = await prisma.order.findMany({
            where: {
                status: "delivered",
                created_at: {
                    gte: startOfYear,
                    lte: endOfYear,
                },
            },
            select: {
                total_amount: true,
                created_at: true,
            },
        });

        // Khoi tao mang 12 thang
        const monthsData = [];
        for (let m = 1; m <= 12; m++) {
            monthsData.push({
                month_number: m,
                label: `Tháng ${m}`,
                revenue: 0,
                order_count: 0,
            });
        }

        let totalYearRevenue = 0;
        let totalYearOrders = 0;

        orders.forEach((order) => {
            const monthIdx = order.created_at.getMonth(); // 0 = Thang 1, 11 = Thang 12
            const amount = Number(order.total_amount);

            monthsData[monthIdx].revenue += amount;
            monthsData[monthIdx].order_count += 1;
            totalYearRevenue += amount;
            totalYearOrders += 1;
        });

        return res.status(200).json({
            success: true,
            period: "month",
            year: selectedYear,
            summary: {
                total_revenue: totalYearRevenue,
                total_orders: totalYearOrders,
            },
            chart_data: monthsData,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while generating revenue chart",
            error: error.message,
        });
    }
};
