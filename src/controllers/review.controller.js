const prisma = require("../prisma/prisma");

// 1. Tao danh gia va cham diem san pham (Role: CUSTOMER, don hang status = 'delivered')
exports.createReview = async (req, res) => {
    try {
        const user_id = Number(req.user.userId);
        const {
            order_item_id,
            product_id,
            rating,
            title,
            comment,
            images = [],
        } = req.body;

        // Validation rating (phai la so nguyen tu 1 den 5)
        const numericRating = Number(rating);
        if (!rating || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating is required and must be an integer between 1 and 5 stars.",
            });
        }

        if (!order_item_id && !product_id) {
            return res.status(400).json({
                success: false,
                message: "Either order_item_id or product_id must be provided.",
            });
        }

        let targetOrderItemId = null;
        let targetProductId = null;

        if (order_item_id) {
            // Tim orderItem theo order_item_id
            const orderItem = await prisma.orderItem.findUnique({
                where: { order_item_id: Number(order_item_id) },
                include: {
                    order: true,
                    variant: true,
                    reviews: true,
                },
            });

            if (!orderItem) {
                return res.status(404).json({
                    success: false,
                    message: `Order item with ID ${order_item_id} not found!`,
                });
            }

            // Kiem tra quyen so huu don hang
            if (orderItem.order.user_id !== user_id) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied! You can only review items from your own orders.",
                });
            }

            // Kiem tra don hang da giao thanh cong chua (status = 'delivered')
            if (orderItem.order.status !== "delivered") {
                return res.status(400).json({
                    success: false,
                    message: `You can only review products from delivered orders. Current order status is "${orderItem.order.status}".`,
                });
            }

            // Kiem tra xem muc nay da duoc danh gia chua
            if (orderItem.reviews && orderItem.reviews.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "You have already reviewed this purchased item.",
                });
            }

            targetOrderItemId = orderItem.order_item_id;
            targetProductId = orderItem.variant ? orderItem.variant.product_id : null;

            if (!targetProductId) {
                return res.status(400).json({
                    success: false,
                    message: "Product variant not found for this order item.",
                });
            }
        } else {
            // Truong hop nguoi dung gui product_id (tu trang chi tiet san pham)
            const product = await prisma.product.findUnique({
                where: { product_id: Number(product_id) },
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product with ID ${product_id} not found!`,
                });
            }

            // Tim 1 order_item cua khach hang nay cho san pham do trong don hang delivered ma chua duoc danh gia
            const eligibleOrderItem = await prisma.orderItem.findFirst({
                where: {
                    order: {
                        user_id: user_id,
                        status: "delivered",
                    },
                    variant: {
                        product_id: Number(product_id),
                    },
                    reviews: {
                        none: {},
                    },
                },
                include: {
                    variant: true,
                },
            });

            if (!eligibleOrderItem) {
                // Kiem tra xem user da tung mua san pham nay chua
                const hasPurchased = await prisma.orderItem.findFirst({
                    where: {
                        order: {
                            user_id: user_id,
                            status: "delivered",
                        },
                        variant: {
                            product_id: Number(product_id),
                        },
                    },
                });

                if (!hasPurchased) {
                    return res.status(400).json({
                        success: false,
                        message: "You can only review products that you have purchased and received (order status: delivered).",
                    });
                } else {
                    return res.status(400).json({
                        success: false,
                        message: "You have already reviewed all purchased items for this product.",
                    });
                }
            }

            targetOrderItemId = eligibleOrderItem.order_item_id;
            targetProductId = Number(product_id);
        }

        // Thuc hien Transaction: Tao Review, cap nhat anh, va tinh toan lai rating_avg + review_count
        const result = await prisma.$transaction(async (tx) => {
            // 1. Tao danh gia moi
            const newReview = await tx.review.create({
                data: {
                    user_id,
                    product_id: targetProductId,
                    order_item_id: targetOrderItemId,
                    rating: numericRating,
                    title: title || null,
                    comment: comment || null,
                    images: Array.isArray(images) && images.length > 0 ? {
                        create: images.map((img) => ({
                            image_url: typeof img === "string" ? img : img.image_url,
                        })),
                    } : undefined,
                },
                include: {
                    images: true,
                    user: {
                        select: {
                            user_id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                },
            });

            // 2. Tinh toan lai diem danh gia trung binh va tong so luot danh gia
            const stats = await tx.review.aggregate({
                where: { product_id: targetProductId },
                _avg: { rating: true },
                _count: { review_id: true },
            });

            const avgRating = stats._avg.rating ? Number(Number(stats._avg.rating).toFixed(1)) : 0.0;
            const reviewCount = stats._count.review_id || 0;

            // 3. Cap nhat rating_avg va review_count vao bang Product
            await tx.product.update({
                where: { product_id: targetProductId },
                data: {
                    rating_avg: avgRating,
                    review_count: reviewCount,
                },
            });

            return {
                review: newReview,
                updated_stats: {
                    product_id: targetProductId,
                    rating_avg: avgRating,
                    review_count: reviewCount,
                },
            };
        });

        return res.status(201).json({
            success: true,
            message: "Review submitted successfully and product rating recalculated!",
            data: result.review,
            product_stats: result.updated_stats,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while submitting review",
            error: error.message,
        });
    }
};

// 2. Lay danh sach danh gia cua 1 san pham (Public)
exports.getProductReviews = async (req, res) => {
    try {
        const productId = Number(req.params.productId || req.params.id || req.query.product_id);
        const {
            page = 1,
            limit = 10,
            rating,
            sort = "newest",
        } = req.query;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required!",
            });
        }

        // Kiem tra san pham co ton tai khong
        const product = await prisma.product.findUnique({
            where: { product_id: productId },
            select: {
                product_id: true,
                name: true,
                rating_avg: true,
                review_count: true,
            },
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found!",
            });
        }

        const skip = (Number(page) - 1) * Number(limit);
        const where = { product_id: productId };

        if (rating) {
            where.rating = Number(rating);
        }

        // Xac dinh thu tu sap xep
        let orderBy = { created_at: "desc" };
        if (sort === "highest") {
            orderBy = { rating: "desc" };
        } else if (sort === "lowest") {
            orderBy = { rating: "asc" };
        } else if (sort === "oldest") {
            orderBy = { created_at: "asc" };
        }

        // Truy van danh sach danh gia, tong so va thong ke so sao
        const [reviews, total, starStats] = await Promise.all([
            prisma.review.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy,
                include: {
                    images: {
                        select: {
                            review_image_id: true,
                            image_url: true,
                        },
                    },
                    user: {
                        select: {
                            user_id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                    order_item: {
                        select: {
                            variant_id: true,
                            variant: {
                                select: {
                                    sku: true,
                                    color: true,
                                    size: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.review.count({ where }),
            prisma.review.groupBy({
                by: ["rating"],
                where: { product_id: productId },
                _count: { rating: true },
            }),
        ]);

        // Tao bang phan bo so luong danh gia theo so sao (1-5 sao)
        const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        starStats.forEach((item) => {
            ratingBreakdown[item.rating] = item._count.rating;
        });

        return res.status(200).json({
            success: true,
            product: {
                product_id: product.product_id,
                name: product.name,
                rating_avg: Number(product.rating_avg),
                review_count: product.review_count,
                rating_breakdown: ratingBreakdown,
            },
            data: reviews,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while fetching product reviews",
            error: error.message,
        });
    }
};

// 3. Lay danh sach cac danh gia cua chinh nguoi dung hien tai (Role: CUSTOMER)
exports.getMyReviews = async (req, res) => {
    try {
        const user_id = Number(req.user.userId);
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where: { user_id },
                skip,
                take: Number(limit),
                orderBy: { created_at: "desc" },
                include: {
                    images: true,
                    product: {
                        select: {
                            product_id: true,
                            name: true,
                            image_url: true,
                            price: true,
                        },
                    },
                    order_item: {
                        select: {
                            variant_id: true,
                            variant: {
                                select: {
                                    sku: true,
                                    color: true,
                                    size: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.review.count({ where: { user_id } }),
        ]);

        return res.status(200).json({
            success: true,
            data: reviews,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while fetching your reviews",
            error: error.message,
        });
    }
};

// 4. Xoa danh gia (Nguoi viet hoac Admin) va tu dong tinh toan lai rating san pham
exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = Number(req.user.userId);
        const userRole = req.user.role ? req.user.role.toUpperCase() : "";

        const existingReview = await prisma.review.findUnique({
            where: { review_id: Number(id) },
        });

        if (!existingReview) {
            return res.status(404).json({
                success: false,
                message: "Review not found!",
            });
        }

        // Chi cho phep chu danh gia hoac Admin xoa
        if (existingReview.user_id !== user_id && userRole !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Access denied! You can only delete your own reviews.",
            });
        }

        const productId = existingReview.product_id;

        // Xoa review va tinh lai thong ke trong Transaction
        await prisma.$transaction(async (tx) => {
            // Xoa review (review_image tu cascade xoa)
            await tx.review.delete({
                where: { review_id: Number(id) },
            });

            // Tinh lai thong so sau khi xoa
            const stats = await tx.review.aggregate({
                where: { product_id: productId },
                _avg: { rating: true },
                _count: { review_id: true },
            });

            const avgRating = stats._avg.rating ? Number(Number(stats._avg.rating).toFixed(1)) : 0.0;
            const reviewCount = stats._count.review_id || 0;

            await tx.product.update({
                where: { product_id: productId },
                data: {
                    rating_avg: avgRating,
                    review_count: reviewCount,
                },
            });
        });

        return res.status(200).json({
            success: true,
            message: "Review deleted successfully and product rating recalculated!",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while deleting review",
            error: error.message,
        });
    }
};
