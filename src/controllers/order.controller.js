const prisma = require("../prisma/prisma");

// 1. Tao don hang tu gio hang (Role: CUSTOMER)
exports.createOrderFromCart = async (req, res) => {
    try {
        const user_id = Number(req.user.userId);
        const {
            receiver_name,
            receiver_phone,
            shipping_address,
            shipping_method = "standard",
            shipping_fee = 0,
            discount_amount = 0,
            payment_method = "COD",
        } = req.body;

        // Validation thong tin giao hang bat buoc
        if (!receiver_name || !receiver_phone || !shipping_address) {
            return res.status(400).json({
                success: false,
                message: "receiver_name, receiver_phone and shipping_address are required!",
            });
        }

        // Lay cac san pham da chon trong gio hang cua user
        const cartItems = await prisma.cartItem.findMany({
            where: {
                user_id,
                is_selected: true,
            },
            include: {
                variant: {
                    include: {
                        product: true,
                    },
                },
            },
        });

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No items selected in cart for checkout! Please select items with is_selected = true first.",
            });
        }

        // Kiem tra ton kho cua tung san pham
        for (const item of cartItems) {
            if (!item.variant) {
                return res.status(400).json({
                    success: false,
                    message: `Variant with ID ${item.variant_id} not found!`,
                });
            }
            if (item.variant.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Product variant "${item.variant.name || item.variant.sku}" only has ${item.variant.stock} item(s) left in stock, but ${item.quantity} requested.`,
                });
            }
        }

        // Tinh tong tien cac mon hang
        const itemsTotal = cartItems.reduce((sum, item) => {
            const itemPrice = Number(item.variant.price);
            return sum + itemPrice * item.quantity;
        }, 0);

        const finalTotal = itemsTotal + Number(shipping_fee) - Number(discount_amount);
        const total_amount = Math.max(0, finalTotal);

        // Thuc hien Transaction tao Order, OrderItems, tru stock, tao Payment, xoa CartItems
        const result = await prisma.$transaction(async (tx) => {
            // 1. Tao Order
            const newOrder = await tx.order.create({
                data: {
                    user_id,
                    receiver_name,
                    receiver_phone,
                    shipping_address,
                    shipping_method,
                    shipping_fee: Number(shipping_fee),
                    discount_amount: Number(discount_amount),
                    total_amount,
                    payment_method,
                    status: "pending",
                },
            });

            // 2. Tao cac OrderItem & Cap nhat stock cho ProductVariant
            for (const item of cartItems) {
                await tx.orderItem.create({
                    data: {
                        order_id: newOrder.order_id,
                        variant_id: item.variant_id,
                        quantity: item.quantity,
                        unit_price: Number(item.variant.price),
                    },
                });

                // Tru stock cua ProductVariant
                await tx.productVariant.update({
                    where: { variant_id: item.variant_id },
                    data: {
                        stock: {
                            decrement: item.quantity,
                        },
                    },
                });

                // Tang sold_count cua Product
                await tx.product.update({
                    where: { product_id: item.variant.product_id },
                    data: {
                        sold_count: {
                            increment: item.quantity,
                        },
                    },
                });
            }

            // 3. Tao ban ghi Payment khoi tao
            const payment = await tx.payment.create({
                data: {
                    order_id: newOrder.order_id,
                    method: payment_method,
                    amount: total_amount,
                    status: "pending",
                },
            });

            // 4. Xoa cac CartItem da dat khoi gio hang
            const cartItemIds = cartItems.map((c) => c.cart_item_id);
            await tx.cartItem.deleteMany({
                where: {
                    cart_item_id: { in: cartItemIds },
                },
            });

            // 5. Query lai thong tin Order hoan chinh de tra ve
            const fullOrder = await tx.order.findUnique({
                where: { order_id: newOrder.order_id },
                include: {
                    order_items: {
                        include: {
                            variant: {
                                include: {
                                    product: true,
                                },
                            },
                        },
                    },
                    payments: true,
                },
            });

            return fullOrder;
        });

        return res.status(201).json({
            success: true,
            message: "Order placed successfully from cart!",
            data: result,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while creating order from cart",
            error: error.message,
        });
    }
};

// 2. Lay danh sach don hang cua chinh Customer (Role: CUSTOMER)
exports.getMyOrders = async (req, res) => {
    try {
        const user_id = Number(req.user.userId);
        const { page = 1, limit = 10, status } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where = { user_id };
        if (status) {
            where.status = status;
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    order_items: {
                        include: {
                            variant: {
                                include: {
                                    product: true,
                                },
                            },
                        },
                    },
                    payments: true,
                },
                orderBy: { created_at: "desc" },
            }),
            prisma.order.count({ where }),
        ]);

        return res.status(200).json({
            success: true,
            data: orders,
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
            message: "Error occurred while fetching your orders",
            error: error.message,
        });
    }
};

// 3. Lay chi tiet 1 don hang theo ID (Customer chi xem don cua minh, Admin xem tat ca)
exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = Number(req.user.userId);
        const role = req.user.role ? req.user.role.toUpperCase() : "";

        const order = await prisma.order.findUnique({
            where: { order_id: Number(id) },
            include: {
                user: {
                    select: {
                        user_id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                order_items: {
                    include: {
                        variant: {
                            include: {
                                product: true,
                            },
                        },
                    },
                },
                payments: true,
            },
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found!",
            });
        }

        // Neu khong phai Admin va khong phai chu don hang -> Tu choi truy cap
        if (role !== "ADMIN" && order.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied! You can only view your own orders.",
            });
        }

        return res.status(200).json({
            success: true,
            data: order,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while fetching order details",
            error: error.message,
        });
    }
};

// 4. Khach hang huy don hang cua chinh minh (Role: CUSTOMER, chi khi pending)
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = Number(req.user.userId);

        const order = await prisma.order.findUnique({
        where: { order_id: Number(id) },
        include: {
            order_items: {
                include: {
                    variant: {
                        include: {
                            product: true
                        }
                    }
                }
            },
            payments: true
        }
    });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found!",
            });
        }

        if (order.user_id !== user_id) {
            return res.status(403).json({
                success: false,
                message: "Access denied! You can only cancel your own orders.",
            });
        }

        if (order.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Cannot cancel order with status "${order.status}". Only "pending" orders can be cancelled.`,
            });
        }

        // Transaction cap nhat status va hoan lai ton kho
        const updatedOrder = await prisma.$transaction(async (tx) => {
            // 1. Hoan lai ton kho & giam sold_count
            for (const item of order.order_items) {
                if (item.variant_id) {
                    await tx.productVariant.update({
                        where: { variant_id: item.variant_id },
                        data: {
                            stock: {
                                increment: item.quantity,
                            },
                        },
                    });

                    if (item.variant && item.variant.product_id) {
                        await tx.product.update({
                            where: { product_id: item.variant.product_id },
                            data: {
                                sold_count: {
                                    decrement: item.quantity,
                                },
                            },
                        });
                    }
                }
            }

            // 2. Cap nhat trang thai Payment (neu co)
            await tx.payment.updateMany({
                where: { order_id: Number(id), status: "pending" },
                data: { status: "cancelled" },
            });

            // 3. Cap nhat trang thai Order
            const cancelled = await tx.order.update({
                where: { order_id: Number(id) },
                data: { status: "cancelled" },
                include: {
                    order_items: true,
                    payments: true,
                },
            });

            return cancelled;
        });

        return res.status(200).json({
            success: true,
            message: "Order cancelled successfully and stock has been restored.",
            data: updatedOrder,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while cancelling order",
            error: error.message,
        });
    }
};

// 5. Admin lay danh sach tat ca don hang (Role: ADMIN)
exports.getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, user_id } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where = {};
        if (status) where.status = status;
        if (user_id) where.user_id = Number(user_id);

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    user: {
                        select: {
                            user_id: true,
                            name: true,
                            email: true,
                            phone: true,
                        },
                    },
                    order_items: {
                        include: {
                            variant: {
                                include: {
                                    product: true,
                                },
                            },
                        },
                    },
                    payments: true,
                },
                orderBy: { created_at: "desc" },
            }),
            prisma.order.count({ where }),
        ]);

        return res.status(200).json({
            success: true,
            data: orders,
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
            message: "Error occurred while fetching all orders",
            error: error.message,
        });
    }
};

// 6. Admin cap nhat trang thai don hang (Role: ADMIN)
exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ["pending", "confirmed", "shipping", "delivered", "cancelled"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status! Allowed values: ${validStatuses.join(", ")}`,
            });
        }

        const existingOrder = await prisma.order.findUnique({
            where: { order_id: Number(id) },
            include: {
                order_items: {
                    include: {
                        variant: true,
                    },
                },
                payments: true,
            },
        });

        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found!",
            });
        }

        // Neu Admin chuyen sang "cancelled" tu trang thai chua huy -> Hoan ton kho
        if (status === "cancelled" && existingOrder.status !== "cancelled") {
            const updated = await prisma.$transaction(async (tx) => {
                for (const item of existingOrder.order_items) {
                    if (item.variant_id) {
                        await tx.productVariant.update({
                            where: { variant_id: item.variant_id },
                            data: { stock: { increment: item.quantity } },
                        });

                        if (item.variant && item.variant.product_id) {
                            await tx.product.update({
                                where: { product_id: item.variant.product_id },
                                data: { sold_count: { decrement: item.quantity } },
                            });
                        }
                    }
                }

                await tx.payment.updateMany({
                    where: { order_id: Number(id), status: "pending" },
                    data: { status: "cancelled" },
                });

                return await tx.order.update({
                    where: { order_id: Number(id) },
                    data: { status },
                    include: {
                        order_items: true,
                        payments: true,
                    },
                });
            });

            return res.status(200).json({
                success: true,
                message: `Order status updated to "${status}" and stock has been restored.`,
                data: updated,
            });
        }

        // Truong hop chuyen sang "delivered" va thanh toan COD -> Tu dong danh dau da thanh toan
        const updated = await prisma.$transaction(async (tx) => {
            if (status === "delivered" && existingOrder.payment_method === "COD") {
                await tx.payment.updateMany({
                    where: { order_id: Number(id), status: "pending" },
                    data: {
                        status: "completed",
                        paid_at: new Date(),
                    },
                });
            }

            return await tx.order.update({
                where: { order_id: Number(id) },
                data: { status },
                include: {
                    order_items: true,
                    payments: true,
                },
            });
        });

        return res.status(200).json({
            success: true,
            message: `Order status updated to "${status}" successfully.`,
            data: updated,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while updating order status",
            error: error.message,
        });
    }
};

// 7. Admin xoa don hang (Role: ADMIN)
exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const existingOrder = await prisma.order.findUnique({
            where: { order_id: Number(id) },
        });

        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found!",
            });
        }

        await prisma.order.delete({
            where: { order_id: Number(id) },
        });

        return res.status(200).json({
            success: true,
            message: "Order deleted successfully!",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while deleting order",
            error: error.message,
        });
    }
};
