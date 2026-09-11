const prisma = require("../prisma/prisma");

// 1. Lay danh sach san pham trong gio hang cua User
exports.getCart = async (req, res) => {
    try {
        const user_id = Number(req.user.userId);

        const cartItems = await prisma.cartItem.findMany({
            where: { user_id },
            include: {
                variant: {
                    include: {
                        product: true,
                    },
                },
            },
            orderBy: { cart_item_id: "desc" },
        });

        let totalAmount = 0;
        let selectedCount = 0;

        cartItems.forEach((item) => {
            if (item.is_selected && item.variant) {
                totalAmount += Number(item.variant.price) * item.quantity;
                selectedCount += item.quantity;
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                items: cartItems,
                summary: {
                    total_items: cartItems.length,
                    selected_items_count: selectedCount,
                    total_amount: totalAmount,
                },
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error fetching cart items",
            error: error.message,
        });
    }
};

// 2. Them san pham vao gio hang (mac dinh bat is_selected = true de checkout duoc ngay)
exports.addToCart = async (req, res) => {
    try {
        const user_id = Number(req.user.userId);
        const { variant_id, quantity = 1 } = req.body;

        if (!variant_id) {
            return res.status(400).json({
                success: false,
                message: "variant_id is required!",
            });
        }

        const numQuantity = Number(quantity);
        if (numQuantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be greater than 0!",
            });
        }

        const variant = await prisma.productVariant.findUnique({
            where: { variant_id: Number(variant_id) },
        });

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Product variant not found!",
            });
        }

        const existingCartItem = await prisma.cartItem.findFirst({
            where: {
                user_id,
                variant_id: Number(variant_id),
            },
        });

        let resultItem;
        if (existingCartItem) {
            const newQuantity = existingCartItem.quantity + numQuantity;
            if (variant.stock < newQuantity) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot add more. Only ${variant.stock} items left in stock.`,
                });
            }

            resultItem = await prisma.cartItem.update({
                where: { cart_item_id: existingCartItem.cart_item_id },
                data: {
                    quantity: newQuantity,
                    is_selected: true,
                },
                include: { variant: { include: { product: true } } },
            });
        } else {
            if (variant.stock < numQuantity) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${variant.stock} items left in stock.`,
                });
            }

            resultItem = await prisma.cartItem.create({
                data: {
                    user_id,
                    variant_id: Number(variant_id),
                    quantity: numQuantity,
                    is_selected: true,
                },
                include: { variant: { include: { product: true } } },
            });
        }

        return res.status(200).json({
            success: true,
            message: "Item added to cart successfully!",
            data: resultItem,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error adding item to cart",
            error: error.message,
        });
    }
};

// 3. Cap nhat so luong hoac trang thai chon (is_selected)
exports.updateCartItem = async (req, res) => {
    try {
        const user_id = Number(req.user.userId);
        const { id } = req.params;
        const { quantity, is_selected } = req.body;

        const existingCartItem = await prisma.cartItem.findFirst({
            where: {
                cart_item_id: Number(id),
                user_id,
            },
            include: { variant: true },
        });

        if (!existingCartItem) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found in your cart!",
            });
        }

        const dataToUpdate = {};
        if (quantity !== undefined) {
            const numQty = Number(quantity);
            if (numQty <= 0) {
                await prisma.cartItem.delete({ where: { cart_item_id: Number(id) } });
                return res.status(200).json({
                    success: true,
                    message: "Item removed from cart because quantity is 0.",
                });
            }

            if (existingCartItem.variant && existingCartItem.variant.stock < numQty) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${existingCartItem.variant.stock} items in stock.`,
                });
            }
            dataToUpdate.quantity = numQty;
        }

        if (is_selected !== undefined) {
            dataToUpdate.is_selected = Boolean(is_selected);
        }

        const updated = await prisma.cartItem.update({
            where: { cart_item_id: Number(id) },
            data: dataToUpdate,
            include: { variant: { include: { product: true } } },
        });

        return res.status(200).json({
            success: true,
            message: "Cart item updated successfully!",
            data: updated,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error updating cart item",
            error: error.message,
        });
    }
};

// 4. Xoa 1 mon do khoi gio hang
exports.deleteCartItem = async (req, res) => {
    try {
        const user_id = Number(req.user.userId);
        const { id } = req.params;

        const existing = await prisma.cartItem.findFirst({
            where: {
                cart_item_id: Number(id),
                user_id,
            },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found!",
            });
        }

        await prisma.cartItem.delete({
            where: { cart_item_id: Number(id) },
        });

        return res.status(200).json({
            success: true,
            message: "Item removed from cart successfully!",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting cart item",
            error: error.message,
        });
    }
};

// 5. Xoa toan bo gio hang
exports.clearCart = async (req, res) => {
    try {
        const user_id = Number(req.user.userId);

        await prisma.cartItem.deleteMany({
            where: { user_id },
        });

        return res.status(200).json({
            success: true,
            message: "Cart cleared successfully!",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error clearing cart",
            error: error.message,
        });
    }
};