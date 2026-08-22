const prisma = require("../prisma/prisma");

// 1. Lay danh sach san pham (phan trang + tim kiem + loc category)
exports.getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", category_id } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where = {
            status: "active",
        };

        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        if (category_id) {
            where.category_id = Number(category_id);
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    category: true,
                    seller: {
                        select: {
                            user_id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { created_at: "desc" },
            }),
            prisma.product.count({ where }),
        ]);

        return res.status(200).json({
            success: true,
            data: products,
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
            message: "Error occurred while fetching products",
            error: error.message,
        });
    }
};

// 2. Lay chi tiet san pham theo ID (include category, seller, variants)
exports.getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.findUnique({
            where: { product_id: Number(id) },
            include: {
                category: true,
                seller: {
                    select: {
                        user_id: true,
                        name: true,
                        email: true,
                    },
                },
                variants: true,
            },
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found!",
            });
        }

        return res.status(200).json({
            success: true,
            data: product,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while fetching product",
            error: error.message,
        });
    }
};

// 3. Tao san pham moi (lay seller_id tu token)
exports.createProduct = async (req, res) => {
    try {
        const seller_id = Number(req.user.userId);
        const {
            name,
            description,
            image_url,
            brand,
            price,
            discount_percent,
            warranty_months,
            low_stock_threshold,
            category_id,
            status,
        } = req.body;

        if (!name || !price || !category_id) {
            return res.status(400).json({
                success: false,
                message: "Name, price and category_id are required!",
            });
        }

        // Kiem tra Category co ton tai hay khong
        const categoryExists = await prisma.category.findUnique({
            where: { category_id: Number(category_id) },
        });

        if (!categoryExists) {
            return res.status(404).json({
                success: false,
                message: `Category with ID ${category_id} does not exist! Please create the category first or use a valid category_id.`,
            });
        }

        // Kiem tra Seller (User) co ton tai hay khong
        const sellerExists = await prisma.user.findUnique({
            where: { user_id: seller_id },
        });

        if (!sellerExists) {
            return res.status(404).json({
                success: false,
                message: `Seller/User with ID ${seller_id} from token does not exist in database!`,
            });
        }

        const newProduct = await prisma.product.create({
            data: {
                name,
                description,
                image_url,
                brand,
                price: Number(price),
                discount_percent: discount_percent ? Number(discount_percent) : 0,
                warranty_months: warranty_months ? Number(warranty_months) : 0,
                low_stock_threshold: low_stock_threshold ? Number(low_stock_threshold) : 5,
                seller_id,
                category_id: Number(category_id),
                status: status || "active",
            },
            include: {
                category: true,
                seller: {
                    select: {
                        user_id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return res.status(201).json({
            success: true,
            message: "Product created successfully!",
            data: newProduct,
        });
    } catch (error) {
        if (error.code === "P2003") {
            return res.status(400).json({
                success: false,
                message: "Foreign key constraint failed. Please check if category_id and seller_id exist.",
                error: error.message,
            });
        }
        return res.status(500).json({
            success: false,
            message: "Error occurred while creating product",
            error: error.message,
        });
    }
};

// 4. Cap nhat san pham
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const existingProduct = await prisma.product.findUnique({
            where: { product_id: Number(id) },
        });

        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found!",
            });
        }

        const {
            name,
            description,
            image_url,
            brand,
            price,
            discount_percent,
            warranty_months,
            low_stock_threshold,
            category_id,
            status,
        } = req.body;

        const data = {};
        if (name !== undefined) data.name = name;
        if (description !== undefined) data.description = description;
        if (image_url !== undefined) data.image_url = image_url;
        if (brand !== undefined) data.brand = brand;
        if (price !== undefined) data.price = Number(price);
        if (discount_percent !== undefined) data.discount_percent = Number(discount_percent);
        if (warranty_months !== undefined) data.warranty_months = Number(warranty_months);
        if (low_stock_threshold !== undefined) data.low_stock_threshold = Number(low_stock_threshold);
        if (category_id !== undefined) data.category_id = Number(category_id);
        if (status !== undefined) data.status = status;

        const updatedProduct = await prisma.product.update({
            where: { product_id: Number(id) },
            data,
            include: {
                category: true,
                seller: {
                    select: {
                        user_id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return res.status(200).json({
            success: true,
            message: "Product updated successfully!",
            data: updatedProduct,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while updating product",
            error: error.message,
        });
    }
};

// 5. Xoa san pham
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const existingProduct = await prisma.product.findUnique({
            where: { product_id: Number(id) },
        });

        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found!",
            });
        }

        await prisma.product.delete({
            where: { product_id: Number(id) },
        });

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully!",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while deleting product",
            error: error.message,
        });
    }
};
