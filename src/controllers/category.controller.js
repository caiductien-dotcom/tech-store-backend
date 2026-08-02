const prisma = require("../prisma/prisma");

// 1. lay danh sach tat ca danh muc 
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        return res.status(200).json({
            success: true,
            data: categories
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while fetching categories",
            error: error.message
        });
    }
};

// 2. lay danh muc theo id
exports.getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await prisma.category.findUnique({
            where: { category_id: Number(id) }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found!"
            });
        }

        return res.status(200).json({
            success: true,
            data: category
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while fetching category",
            error: error.message
        });
    }
};

// 3.tao danh muc moi (chi cho phep admin)
exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required!"
            });
        }

        const categoryExists = await prisma.category.findUnique({ where: { name } });
        if (categoryExists) {
            return res.status(400).json({
                success: false,
                message: "Category with this name already exists!"
            });
        }

        const newCategory = await prisma.category.create({
            data: { name, description }
        });

        return res.status(201).json({
            success: true,
            message: "Category created successfully!",
            data: newCategory
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while creating category",
            error: error.message
        });
    }
};

// 4. cap nhat danh muc (chi cho phep admin)
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updatedCategory = await prisma.category.update({
            where: { category_id: Number(id) },
            data: { name, description }
        });

        return res.status(200).json({
            success: true,
            message: "Category updated successfully!",
            data: updatedCategory
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while updating category",
            error: error.message
        });
    }
};

// 5. xoa danh muc (chi cho phep admin)
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.category.delete({
            where: { category_id: Number(id) }
        });

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully!"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error occurred while deleting category",
            error: error.message
        });
    }
};