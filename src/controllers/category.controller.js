const { PrismaClient}=require('@prisma/client');
const prisma= new PrismaClient();

// lay danh sach tat ca danh muc
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany();
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: "Error occurred while fetching categories", error: error.message });
    }
};
//lay danh muc moi(only admin )
exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Error: Category name is required!" });
        }

        const categoryExists = await prisma.category.findUnique({ where: { name } });
        if (categoryExists) {
            return res.status(400).json({ message: "Error: Category with this name already exists!" });
        }

        const newCategory = await prisma.category.create({
            data: { name, description }
        });

        res.status(201).json({ message: "Error: Category created successfully!", data: newCategory });
    } catch (error) {
        res.status(500).json({ message: "Error occurred while creating category", error: error.message });
    }
};