const express = require('express');
const router = express.Router();
const {
    getAllQnAs,
    getQnAById,
    askQuestion,
    answerQuestion,
    updateQnAStatus,
    deleteQnA,
    getQuestionsByProduct
} = require('../controllers/qnaControllers');

// Public routes (users can ask questions and view visible QnAs)
router.get('/', getAllQnAs); // GET /api/qna?product_code=ABC&status=visible
router.get('/product/:product_code', getQuestionsByProduct); // GET /api/qna/product/ABC123
router.get('/:id', getQnAById); // GET /api/qna/123
router.post('/ask', askQuestion); // POST /api/qna/ask

// Admin routes (protected - add your auth middleware here)
router.put('/:id/answer', answerQuestion); // PUT /api/qna/123/answer
router.put('/:id/status', updateQnAStatus); // PUT /api/qna/123/status
router.delete('/:id', deleteQnA); // DELETE /api/qna/123

module.exports = router;