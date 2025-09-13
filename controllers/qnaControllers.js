const QnA = require('../models/qna'); // Adjust path as needed

// Get all QnAs (with optional filtering)
const getAllQnAs = async (req, res) => {
    try {
        const { product_code, status } = req.query;
        let filter = {};
        
        if (product_code) filter.product_code = product_code;
        if (status) filter.status = status;

        const qnas = await QnA.find(filter).sort({ createdAt: -1 });
        res.json(qnas);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get single QnA by ID
const getQnAById = async (req, res) => {
    try {
        const qna = await QnA.findById(req.params.id);
        if (!qna) {
            return res.status(404).json({ message: 'QnA not found' });
        }
        res.json(qna);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// User asks a new question
const askQuestion = async (req, res) => {
    try {
        const { product_code, question } = req.body;
        
        if (!product_code || !question) {
            return res.status(400).json({ message: 'Product code and question are required' });
        }

        // Generate a unique question code (you can customize this)
        const question_code = `Q${Date.now()}${Math.random().toString(36).substr(2, 5)}`;

        const newQuestion = new QnA({
            product_code,
            question_code,
            question,
            answer: "", // Empty answer initially
            status: 'visible'
        });

        const savedQuestion = await newQuestion.save();
        res.status(201).json(savedQuestion);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin replies to a question
const answerQuestion = async (req, res) => {
    try {
        const { answer } = req.body;
        
        if (!answer) {
            return res.status(400).json({ message: 'Answer is required' });
        }

        const updatedQnA = await QnA.findByIdAndUpdate(
            req.params.id,
            { 
                answer,
                // You might want to add admin ID tracking here
                // answeredBy: req.user.id 
            },
            { new: true, runValidators: true }
        );

        if (!updatedQnA) {
            return res.status(404).json({ message: 'Question not found' });
        }

        res.json(updatedQnA);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin updates QnA status (visible/hidden)
const updateQnAStatus = async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!status || !['visible', 'hidden'].includes(status)) {
            return res.status(400).json({ message: 'Valid status is required' });
        }

        const updatedQnA = await QnA.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!updatedQnA) {
            return res.status(404).json({ message: 'QnA not found' });
        }

        res.json(updatedQnA);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete QnA (admin only)
const deleteQnA = async (req, res) => {
    try {
        const deletedQnA = await QnA.findByIdAndDelete(req.params.id);
        
        if (!deletedQnA) {
            return res.status(404).json({ message: 'QnA not found' });
        }

        res.json({ message: 'QnA deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get questions for a specific product
const getQuestionsByProduct = async (req, res) => {
    try {
        const { product_code } = req.params;
        const questions = await QnA.find({ 
            product_code, 
            status: 'visible' 
        }).sort({ createdAt: -1 });
        
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllQnAs,
    getQnAById,
    askQuestion,
    answerQuestion,
    updateQnAStatus,
    deleteQnA,
    getQuestionsByProduct
};